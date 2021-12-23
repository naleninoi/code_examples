package pro.gastex.billing.rest;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pro.gastex.app.enums.ActionType;
import pro.gastex.app.messaging.MessagingService;
import pro.gastex.app.model.company.Action;
import pro.gastex.app.model.company.Customer;
import pro.gastex.app.model.company.User;
import pro.gastex.app.service.ActionService;
import pro.gastex.app.service.CustomerService;
import pro.gastex.app.service.RenderService;
import pro.gastex.app.service.SecurityService;
import pro.gastex.billing.dto.BillingProcessPaymentDto;
import pro.gastex.billing.dto.FillBillingAccountDto;
import pro.gastex.billing.dto.ProcessBillingOrderDto;
import pro.gastex.billing.enums.BillingOrderStatus;
import pro.gastex.billing.model.BillingAccount;
import pro.gastex.billing.model.BillingOrder;
import pro.gastex.billing.service.BillingService;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Map;

import static org.apache.commons.codec.digest.DigestUtils.md5Hex;

@RestController
@RequestMapping(value = "/billing")
public class BillingRestController {

    private final BillingService billingService;
    private final CustomerService customerService;
    private final RenderService renderService;
    private final SecurityService securityService;
    private final ActionService actionService;
    private final MessagingService messagingService;

    public BillingRestController(BillingService billingService,
                                 CustomerService customerService,
                                 RenderService renderService,
                                 SecurityService securityService,
                                 ActionService actionService,
                                 MessagingService messagingService) {
        this.billingService = billingService;
        this.customerService = customerService;
        this.renderService = renderService;
        this.securityService = securityService;
        this.actionService = actionService;
        this.messagingService = messagingService;
    }

    @Value("${paykeeper.secret}")
    private String secret;

    @GetMapping(value = "/orders")
    public ResponseEntity<Object> getAllBillingOrders(
            @RequestParam(required = false, defaultValue = "id") String sortBy,
            @RequestParam(required = false, defaultValue = "asc") String sortDir,
            @RequestParam(required = false, defaultValue = "0") Integer page,
            @RequestParam(required = false, defaultValue = "10") Integer pageSize,
            @RequestParam(required = false, defaultValue = "") String dateFrom,
            @RequestParam(required = false, defaultValue = "") String dateTo,
            @RequestParam(required = false, defaultValue = "-1") Long officeId,
            @RequestParam(required = false, defaultValue = "-1") Long customerId,
            @RequestParam(required = false, defaultValue = "NOT_SET") BillingOrderStatus status
    ) throws ParseException {
        Sort sort = sortDir.equals("desc") ? Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();
        if (pageSize == -1) {
            pageSize = 1000000;
        }
        Pageable pageable = PageRequest.of(page, pageSize, sort);

        User currentUser = securityService.getCurrentUser();
        if (currentUser.getOffice() != null) {
            officeId = currentUser.getOffice().getId();
        }
        if (currentUser.getCustomer() != null) {
            customerId = currentUser.getCustomer().getId();
        }

        Date dateFromValue = !dateFrom.equals("") ? new SimpleDateFormat("yyyy-MM-dd").parse(dateFrom) : null;
        Date dateToValue = !dateTo.equals("") ? new SimpleDateFormat("yyyy-MM-dd").parse(dateTo) : null;

        Map<String, Object> result;
        Page<BillingOrder> billingOrdersList = billingService.findAllBillingOrders(
                dateFromValue, dateToValue, officeId,
                customerId, status, pageable);
        billingOrdersList.getContent().forEach(billingService::expireBillingOrder);
        result = renderService.render(billingOrdersList);
        result.put("allowCreate", false);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{customerId}")
    public ResponseEntity<Object> getCustomerBillingAccount(@PathVariable Long customerId) {

        Customer customer = customerService.findById(customerId);
        if (customer == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Ошибка запроса, не найден клиент с ID " + customerId);
        }

        BillingAccount account = billingService.getCustomerBillingAccount(customer);
        if (account == null) {
            account = billingService.createCustomerAccount(customer);
        }

        billingService.actualizeCustomerBillingOrders(customer);

        Map<String, Object> result = renderService.render(account);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{customerId}/fill-account")
    public ResponseEntity<Object> fillCustomerAccount(@PathVariable Long customerId,
                                           @RequestBody FillBillingAccountDto requestDto
    ) {
        Customer customer = customerService.findById(customerId);
        if (customer == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Ошибка запроса, не найден клиент с ID " + customerId);
        }
        BillingAccount account = billingService.getCustomerBillingAccount(customer);
        if (account == null) {
            account = billingService.createCustomerAccount(customer);
        }

        if (!securityService.iCanChange(account)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        BillingOrder billingOrder = new BillingOrder();
        billingOrder.setBillingAccount(account);
        billingOrder.setSum( requestDto.getSum() );
        billingService.save(billingOrder);

        billingService.processBillingOrder(billingOrder);

        actionService.pushAction(Action.create(ActionType.BILLING_ACCOUNT_FILLED)
                .setCustomer(customer)
                .setSum(billingOrder.getSum())
                .setOffice(customer.getOffice()) );

        messagingService.tellUpdated(account);
        messagingService.tellActionToCustomer(customer);
        messagingService.tellActionToOffice(customer.getOffice());
        messagingService.tellActionToAllSuperUsers();

        return ResponseEntity.ok("");
    }

    @PostMapping("/{customerId}/request-order")
    public ResponseEntity<Object> requestBillingOrder(@PathVariable Long customerId,
                                                      @RequestBody FillBillingAccountDto requestDto
    ) {
        Customer customer = customerService.findById(customerId);
        if (customer == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Ошибка запроса, не найден клиент с ID " + customerId);
        }
        BillingAccount account = billingService.getCustomerBillingAccount(customer);
        if (account == null) {
            account = billingService.createCustomerAccount(customer);
        }

        BillingOrder billingOrder = new BillingOrder();
        billingOrder.setBillingAccount(account);
        billingOrder.setSum( requestDto.getSum() );
        billingService.save(billingOrder);

        actionService.pushAction(Action.create(ActionType.BILLING_ORDER_CREATED)
                .setCustomer(customer)
                .setSum(billingOrder.getSum())
                .setOffice(customer.getOffice()) );

        messagingService.tellUpdated(account);

        messagingService.tellActionToCustomer(customer);
        messagingService.tellActionToOffice(customer.getOffice());
        messagingService.tellActionToAllSuperUsers();

        Map<String, Object> result = renderService.render(billingOrder);

        return ResponseEntity.ok(result);
    }

    @PostMapping("/process-order")
    public ResponseEntity<Object> processBillingOrder(@RequestBody ProcessBillingOrderDto requestDto) {
        Customer customer = customerService.findById(requestDto.getCustomerId());
        if (customer == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Ошибка запроса, не найден клиент с ID " + requestDto.getCustomerId());
        }

        BillingAccount account = billingService.getCustomerBillingAccount(customer);
        if (!securityService.iCanChange(account)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        billingService.actualizeCustomerBillingOrders(customer);

        BillingOrder billingOrder = billingService.getOrderById(requestDto.getId());
        if (billingOrder == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Ошибка запроса, не найден счет с ID " + requestDto.getId());
        }
        if (!billingOrder.getStatus().equals(BillingOrderStatus.NEW)) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Cчет с ID " + requestDto.getId() + "устарел или уже оплачен");
        }

        billingService.processBillingOrder(billingOrder);

        actionService.pushAction(Action.create(ActionType.BILLING_ACCOUNT_FILLED)
                .setCustomer(customer)
                .setSum(billingOrder.getSum())
                .setOffice(customer.getOffice()) );

        messagingService.tellUpdated(account);
        messagingService.tellActionToCustomer(customer);
        messagingService.tellActionToOffice(customer.getOffice());
        messagingService.tellActionToAllSuperUsers();

        return ResponseEntity.ok("");
    }

    @PostMapping("/cancel-order")
    public ResponseEntity<Object> cancelBillingOrder(@RequestBody ProcessBillingOrderDto requestDto) {
        Customer customer = customerService.findById(requestDto.getCustomerId());
        if (customer == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Ошибка запроса, не найден клиент с ID " + requestDto.getCustomerId());
        }
        BillingAccount account = billingService.getCustomerBillingAccount(customer);

        billingService.actualizeCustomerBillingOrders(customer);

        BillingOrder billingOrder = billingService.getOrderById(requestDto.getId());
        if (billingOrder == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Ошибка запроса, не найден счет с ID " + requestDto.getId());
        }
        if (!billingOrder.getStatus().equals(BillingOrderStatus.NEW)) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Cчет с ID " + requestDto.getId() + "устарел или уже оплачен");
        }

        billingOrder.setStatus(BillingOrderStatus.CANCELLED);
        billingService.save(billingOrder);

        actionService.pushAction(Action.create(ActionType.BILLING_ORDER_CANCELLED)
                .setCustomer(customer)
                .setSum(billingOrder.getSum())
                .setOffice(customer.getOffice()) );

        messagingService.tellUpdated(account);
        messagingService.tellActionToCustomer(customer);
        messagingService.tellActionToOffice(customer.getOffice());
        messagingService.tellActionToAllSuperUsers();

        return ResponseEntity.ok("");
    }

    @PostMapping(value="/process-payment", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<Object> processPayment(BillingProcessPaymentDto requestDto) {
        String key = md5Hex(requestDto.getId().toString() + requestDto.getSum().toString() + requestDto.getOrderId().toString() + secret);
        String hash = md5Hex(requestDto.getId() + secret);
        if (!requestDto.getKey().equals(key)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        BillingOrder billingOrder = billingService.getOrderById( requestDto.getOrderId() );
        if (billingOrder == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Ошибка запроса, не найден счет с ID " + requestDto.getId());
        }

        BillingAccount account = billingOrder.getBillingAccount();
        Customer customer = account.getCustomer();

        billingService.processBillingOrder(billingOrder);

        actionService.pushAction(Action.create(ActionType.BILLING_ACCOUNT_FILLED)
                .setCustomer(customer)
                .setSum(billingOrder.getSum())
                .setOffice(customer.getOffice()) );

        messagingService.tellUpdated(billingOrder);
        messagingService.tellUpdated(account);
        messagingService.tellActionToCustomer(customer);
        messagingService.tellActionToOffice(customer.getOffice());
        messagingService.tellActionToAllSuperUsers();

        return ResponseEntity.ok(hash);
    }

}
