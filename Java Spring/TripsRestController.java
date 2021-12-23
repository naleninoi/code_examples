package pro.gastex.app.rest;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import pro.gastex.app.dto.company.TripDto;
import pro.gastex.app.enums.ActionType;
import pro.gastex.app.enums.OrderStatus;
import pro.gastex.app.enums.TripStatus;
import pro.gastex.app.enums.UserType;
import pro.gastex.app.messaging.MessagingService;
import pro.gastex.app.model.company.*;
import pro.gastex.app.service.*;

import java.sql.Timestamp;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping(value = "/trips/")
public class TripsRestController {

    private final TripService tripService;
    private final AutoService autoService;
    private final OfficeService officeService;
    private final UserService userService;
    private final OrderService orderService;
    private final SecurityService securityService;
    private final RenderService renderService;
    private final ActionService actionService;
    private final MessagingService messagingService;

    public TripsRestController(TripService tripService,
                               AutoService autoService,
                               OfficeService officeService,
                               UserService userService,
                               OrderService orderService,
                               SecurityService securityService,
                               RenderService renderService,
                               ActionService actionService,
                               MessagingService messagingService) {
        this.tripService = tripService;
        this.autoService = autoService;
        this.officeService = officeService;
        this.userService = userService;
        this.orderService = orderService;
        this.securityService = securityService;
        this.renderService = renderService;
        this.actionService = actionService;
        this.messagingService = messagingService;
    }

    @GetMapping(value = "/{id}")
    public ResponseEntity<Object> getTrip(
            @PathVariable() Long id
    ) {
        Trip trip = tripService.findById(id);
        if (trip != null) {
            Map<String, Object> result = renderService.render(trip);
            return ResponseEntity.ok(result);
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    @GetMapping(value = "")
    public ResponseEntity<Object> getAllTrips(
            @RequestParam(required = false, defaultValue = "dueDate") String sortBy,
            @RequestParam(required = false, defaultValue = "asc") String sortDir,
            @RequestParam(required = false, defaultValue = "0") Integer page,
            @RequestParam(required = false, defaultValue = "10") Integer pageSize,
            @RequestParam(required = false, defaultValue = "") String dateFrom,
            @RequestParam(required = false, defaultValue = "") String dateTo,
            @RequestParam(required = false, defaultValue = "-1") Long officeId,
            @RequestParam(required = false, defaultValue = "-1") Long autoId,
            @RequestParam(required = false, defaultValue = "-1") Long customerId,
            @RequestParam(required = false, defaultValue = "NOT_SET") TripStatus status,
            @RequestParam(required = false, defaultValue = "false") boolean showFinished
    ) throws ParseException {
        Sort sort = sortDir.equals("desc") ? Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, pageSize, sort);

        User currentUser = securityService.getCurrentUser();
        if (currentUser.getOffice() != null) {
            officeId = currentUser.getOffice().getId();
        }

        Date dateFromValue = !dateFrom.equals("") ? new SimpleDateFormat("yyyy-MM-dd").parse(dateFrom) : null;
        Date dateToValue = !dateTo.equals("") ? new SimpleDateFormat("yyyy-MM-dd").parse(dateTo) : null;

        Page<Trip> tripsList = tripService.findAll(dateFromValue, dateToValue, officeId, autoId, customerId, status, showFinished, pageable);
        Map<String, Object> result = renderService.render(tripsList);
        result.put("allowCreate", securityService.iCanCreateTrip());
        return ResponseEntity.ok(result);
    }

    @PostMapping("create")
    public ResponseEntity<Object> createTrip(
            @RequestBody TripDto requestDto
    ) {
        if (!securityService.iCanCreateTrip()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Trip trip = Trip.create();

        User currentUser = securityService.getCurrentUser();
        Auto auto = autoService.findById(requestDto.getAutoId());

        List<Action> actions = new ArrayList<>();
        Set<Customer> customersToNotify = new HashSet<>();

        if (requestDto.getDueDate() == null ) {
            return getErrorResponse("DATE_NOT_SET", "Не установлена дата рейса");
        }

        if (requestDto.getOfficeId() == null &&
                ( currentUser.isAdmin() || currentUser.isCompanyHead() ) ) {
            return getErrorResponse("OFFICE_NOT_SET", "Не выбран офис");
        }

        if ( requestDto.getManagerId() == null ) {
            return getErrorResponse("MANAGER_NOT_SET", "Не выбран менеджер");
        }

        if ( requestDto.getWorkerId() == null ) {
            return getErrorResponse("WORKER_NOT_SET", "Не выбран водитель");
        }

        if ( requestDto.getAutoId() == null ) {
            return getErrorResponse("AUTO_NOT_SET", "Не выбран автомобиль");
        }

        if ( tripService.checkAutoOverload(auto, requestDto) ) {
            return getErrorResponse("AUTO_OVERLOAD", "Превышена грузоподъемность автомобиля");
        }

        if ( !(currentUser.isCompanyHead() || currentUser.isAdmin()) )
            requestDto.setOfficeId(currentUser.getOffice().getId());

        Office office = officeService.findById(requestDto.getOfficeId());
        User manager = userService.findById(requestDto.getManagerId());

        trip.setOffice(office);
        trip.setManager(manager);
        trip.setAuto(auto);
        trip.setDueDate(requestDto.getDueDate());

        if (requestDto.getWorkerId() != null) {
            User worker = userService.findById(requestDto.getWorkerId());
            trip.setWorker(worker);
        }

        // заказы добавляются в рейс
        List<Long> newOrderIds = Arrays.asList(requestDto.getOrderIds());
        if (newOrderIds.size() != 0) {
            newOrderIds.forEach(oid -> {
                Order order = orderService.findById(oid);
                if (order != null) {
                    trip.getOrders().add(order);
                    order.setTrip(trip);
                    Action action = Action.create(ActionType.ORDER_ATTACHED_TO_TRIP)
                            .setOrder(order)
                            .setTrip(trip)
                            .setOffice(trip.getOffice());
                    actions.add(action);
                }
            });
            trip.setStatus(TripStatus.PROCESSING);
        }

        tripService.save(trip);

        actions.add(Action.create(ActionType.TRIP_CREATED)
                .setAuto(auto)
                .setOffice(office)
                .setTrip(trip));

        trip.getOrders().forEach( order -> { // заказы, добавленные в рейс, получают статус в зависимости от статуса рейса
            OrderStatus newOrderStatus = orderService.setOrderStatusByTripStatus(requestDto.getStatus());
            if ( !newOrderStatus.equals(order.getStatus()) && !order.getStatus().isTerminal()) {
                order.setStatus(newOrderStatus);
                Action action = Action.create(ActionType.ORDER_STATUS_CHANGED)
                        .setOrder(order)
                        .setCustomer(order.getCustomer())
                        .setOffice(trip.getOffice());
                actions.add(action);
                customersToNotify.add(order.getCustomer());
            }
        });

        tripService.save(trip);

        actionService.pushActions(actions);
        messagingService.tellUpdatedToOffice( trip );
        messagingService.tellUpdatedToWorker( trip );
        messagingService.tellActionToOffice(office);
        messagingService.tellActionToCustomers(customersToNotify);
        messagingService.tellActionToAllSuperUsers();

        return ResponseEntity.ok("");
    }

    @PostMapping("/{id}/update")
    public ResponseEntity<Object> updateTrip(
            @PathVariable() Long id,
            @RequestBody TripDto requestDto
    ) {
        Trip trip = tripService.findById(id);

        boolean statusChanged = false;
        boolean dataChanged = false;

        if (!securityService.iCanChange(trip)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        if (requestDto.getDueDate() == null ) {
            return getErrorResponse("DATE_NOT_SET", "Не установлена дата рейса");
        }

        if (requestDto.getOfficeId() == null ) {
            return getErrorResponse("OFFICE_NOT_SET", "Не выбран офис");
        }

        if ( requestDto.getManagerId() == null ) {
            return getErrorResponse("MANAGER_NOT_SET", "Не выбран менеджер");
        }

        if ( requestDto.getAutoId() == null ) {
            return getErrorResponse("AUTO_NOT_SET", "Не выбран автомобиль");
        }

        if ( tripService.checkAutoOverload(trip.getAuto(), requestDto) ) {
            return getErrorResponse("AUTO_OVERLOAD", "Превышена грузоподъемность автомобиля");
        }

        if ( !trip.getStatus().equals(requestDto.getStatus()) ) {
            statusChanged = true;
        }

        Office newOffice = officeService.findById(requestDto.getOfficeId());

        User newManager;
        User newWorker = null;
        List<Action> actions = new ArrayList<>();
        Set<Customer> customersToNotify = new HashSet<>();

        newManager = userService.findById(requestDto.getManagerId());
        if (requestDto.getWorkerId() != null) {
            newWorker = userService.findById(requestDto.getWorkerId());
        }
        Auto newAuto = autoService.findById(requestDto.getAutoId());
        Timestamp oldDueDate = new Timestamp(trip.getDueDate().getTime());
        Timestamp newDueDate = new Timestamp(requestDto.getDueDate().getTime());

        // если в созданный рейс (Статус NEW) добавлены заказы, статус меняется на PROCESSING
        if ( tripService.checkTripOrdersChange(trip, requestDto) &&
                requestDto.getStatus().equals(TripStatus.NEW) &&
                trip.getStatus().equals(TripStatus.NEW)  ) {
            requestDto.setStatus(TripStatus.PROCESSING);
        }

        if (!Objects.equals(trip.getOffice(), newOffice) ||
                !Objects.equals(trip.getManager(), newManager) ||
                !Objects.equals(trip.getWorker(), newWorker) ||
                !Objects.equals(trip.getAuto(), newAuto) ||
                !Objects.equals(oldDueDate, newDueDate) ||
                tripService.checkTripOrdersChange(trip, requestDto)
        ) {
            dataChanged = true;
        }

        trip.setOffice(newOffice);
        trip.setManager(newManager);
        trip.setWorker(newWorker);
        trip.setAuto(newAuto);
        trip.setDueDate(newDueDate);
        trip.setStatus(requestDto.getStatus());

        List<Long> prevOrderIds = trip.getOrders().stream()
                .map(Order::getId)
                .collect(Collectors.toList());
        List<Long> newOrderIds = Arrays.asList(requestDto.getOrderIds());

        List<Long> orderIdsToExclude = prevOrderIds.stream()
                .filter(oid -> !newOrderIds.contains(oid))
                .collect(Collectors.toList());
        List<Long> orderIdsToInclude = newOrderIds.stream()
                .filter((oid -> !prevOrderIds.contains(oid)))
                .collect(Collectors.toList());

        orderIdsToExclude.forEach(oid -> { // заказы исключаются из рейса и получают статус PROCESSING
            Order order = orderService.findById(oid);
            trip.getOrders().remove(order);
            order.setTrip(null);
            order.setStatus(OrderStatus.PROCESSING);
            Action actionStatus = Action.create(ActionType.ORDER_STATUS_CHANGED)
                    .setOrder(order)
                    .setCustomer(order.getCustomer())
                    .setOffice(trip.getOffice());
            Action actionDetached = Action.create(ActionType.ORDER_DETACHED_FROM_TRIP)
                    .setOrder(order)
                    .setTrip(trip)
                    .setOffice(trip.getOffice());
            actions.add(actionDetached);
            actions.add(actionStatus);
        });

        orderIdsToInclude.forEach(oid -> { // заказы добавляются в рейс
                    Order order = orderService.findById(oid);
                    if (order != null) {
                        trip.getOrders().add(order);
                        order.setTrip(trip);
                        Action action = Action.create(ActionType.ORDER_ATTACHED_TO_TRIP)
                                .setOrder(order)
                                .setTrip(trip)
                                .setOffice(trip.getOffice());
                        actions.add(action);
                    }
                }
        );

        trip.getOrders().forEach(order -> { // заказы, добавленные в рейс, получают статус в зависимости от статуса рейса
            OrderStatus newOrderStatus = orderService.setOrderStatusByTripStatus(requestDto.getStatus());
            if ( !newOrderStatus.equals(order.getStatus()) && !order.getStatus().isTerminal() ) {
                order.setStatus(newOrderStatus);
                Action action = Action.create(ActionType.ORDER_STATUS_CHANGED)
                        .setOrder(order)
                        .setCustomer(order.getCustomer())
                        .setOffice(trip.getOffice());
                actions.add(action);
                customersToNotify.add(order.getCustomer());
            }
        });

        tripService.save(trip);

        if (dataChanged) {
            Action action = Action.create(ActionType.TRIP_UPDATED);
            action.setTrip(trip);
            action.setAuto(newAuto);
            action.setOffice(newOffice);
            actions.add(action);
            messagingService.tellActionToOffice( trip.getOffice() );
            messagingService.tellActionToCustomers(customersToNotify);
            messagingService.tellActionToAllSuperUsers();
        }

        if (statusChanged) {
            Action action = Action.create(ActionType.TRIP_STATUS_CHANGED);
            action.setTrip(trip);
            action.setOffice(newOffice);
            action.setAuto(newAuto);
            actions.add(action);
            messagingService.tellActionToOffice( trip.getOffice() );
            messagingService.tellActionToCustomers(customersToNotify);
            messagingService.tellActionToAllSuperUsers();
        }

        actionService.pushActions(actions);
        messagingService.tellUpdated( trip );
        messagingService.tellUpdatedToOffice( trip );
        messagingService.tellUpdatedToWorker( trip );

        return ResponseEntity.ok("");
    }

    @GetMapping(value = "/select")
    public ResponseEntity<Object> selectTrips(
            @RequestParam(required = false, defaultValue = "id") String sortBy,
            @RequestParam(required = false, defaultValue = "asc") String sortDir,
            @RequestParam(required = false, defaultValue = "") String dateFrom,
            @RequestParam(required = false, defaultValue = "") String dateTo,
            @RequestParam(required = false, defaultValue = "-1") Long officeId,
            @RequestParam(required = false, defaultValue = "-1") Long workerId,
            @RequestParam(required = false, defaultValue = "-1") Long autoId,
            @RequestParam(required = false, defaultValue = "NOT_SET") List<TripStatus> statuses
    ) throws ParseException {
        Sort sort = sortDir.equals("desc") ? Sort.by(sortBy).descending() : Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(0, Integer.MAX_VALUE, sort);

        User currentUser = securityService.getCurrentUser();
        if (currentUser.getOffice() != null) {
            officeId = currentUser.getOffice().getId();
        }
        if (currentUser.getUserType().equals(UserType.OFFICE_WORKER)) {
            workerId = currentUser.getId();
        }

        Date dateFromValue = !dateFrom.equals("") ? new SimpleDateFormat("yyyy-MM-dd").parse(dateFrom) : null;
        Date dateToValue = !dateTo.equals("") ? new SimpleDateFormat("yyyy-MM-dd").parse(dateTo) : null;

        Map<String, Object> result;
        Page<Trip> tripsList = tripService.select(
                dateFromValue, dateToValue, officeId, workerId,
                autoId, statuses, pageable);

        result = renderService.render(tripsList);

        return ResponseEntity.ok(result);
    }

    @PostMapping("/{tripId}/add-order/{orderId}")
    public ResponseEntity<Object> addOrderToTrip(
            @PathVariable() Long tripId,
            @PathVariable() Long orderId) {

        Trip trip = tripService.findById(tripId);
        if (!securityService.iCanChange(trip)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        Auto auto = trip.getAuto();

        Order order = orderService.findById(orderId);

        if (order == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        List<Action> actions = new ArrayList<>();

        if (trip.getTotalWeight() + order.getWeight() > auto.getCapacity()) {
            return getErrorResponse("AUTO_OVERLOAD", "Превышена грузоподъемность автомобиля");
        }
        if (trip.getOrders().contains(order)) {
            return ResponseEntity.ok("");
        }

        order.setStatus(OrderStatus.ON_WAY);
        trip.getOrders().add(order);
        order.setTrip(trip);
        if (trip.getStatus().equals(TripStatus.NEW)) {
            trip.setStatus(TripStatus.PROCESSING);
        }
        tripService.save(trip);

        Action tripAction = Action.create(ActionType.TRIP_UPDATED);
        tripAction.setTrip(trip);
        tripAction.setAuto(auto);
        tripAction.setOffice(trip.getOffice());
        actions.add(tripAction);

        Action orderAction = Action.create(ActionType.ORDER_STATUS_CHANGED)
                .setOrder(order)
                .setCustomer(order.getCustomer())
                .setOffice(trip.getOffice());
        actions.add(orderAction);

        Action actionAttach = Action.create(ActionType.ORDER_ATTACHED_TO_TRIP)
                .setOrder(order)
                .setTrip(trip)
                .setOffice(trip.getOffice());
        actions.add(actionAttach);

        actionService.pushActions(actions);

        messagingService.tellActionToOffice( trip.getOffice() );
        messagingService.tellActionToCustomer( order.getCustomer() );
        messagingService.tellActionToAllSuperUsers();
        messagingService.tellUpdated(trip);
        messagingService.tellUpdatedToOffice(trip);
        messagingService.tellUpdatedToWorker( trip );
        messagingService.tellUpdated(order);
        messagingService.tellUpdatedToOffice(order);

        return ResponseEntity.ok("");
    }


    private ResponseEntity<Object> getErrorResponse(String error, String message) {
        String body = String.format("{ \"error\": \"%s\", \"message\": \"%s\" }", error, message);
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body);
    }

}
