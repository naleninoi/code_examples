package pro.gastex.app.model.company;

import pro.gastex.app.enums.OrderStatus;
import pro.gastex.app.model.BaseEntity;

import javax.persistence.*;
import java.io.Serializable;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.HashSet;

@Entity
@Table(name = "orders")
public class Order extends BaseEntity {

    public static Long ORDER_ANY = -1L;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn( name="office_id", referencedColumnName = "id")
    private Office office;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn( name="customer_id", referencedColumnName = "id")
    private Customer customer;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn( name="customer_user_id", referencedColumnName = "id")
    private User customerUser;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn( name="office_user_id", referencedColumnName = "id")
    private User officeUser;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn( name="address_id", referencedColumnName = "id")
    private Address address;

    @Column(name = "status")
    @Enumerated(EnumType.STRING)
    private OrderStatus status;

    @Column(name = "prev_state")
    private String previousState;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL)
    private Collection<OrderPosition> orderPositions = new ArrayList<>();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL)
    private Collection<OrderReturnBottle> orderReturnBottles = new ArrayList<>();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL)
    private Collection<OrderComment> orderComments = new ArrayList<>();

    @ManyToOne(fetch = FetchType.EAGER, cascade = CascadeType.ALL)
    @JoinColumn(name = "trip_id", referencedColumnName = "id")
    private Trip trip;

    public Office getOffice() {
        return office;
    }

    public void setOffice(Office office) {
        this.office = office;
    }

    public Customer getCustomer() {
        return customer;
    }

    public void setCustomer(Customer customer) {
        this.customer = customer;
    }

    public User getCustomerUser() {
        return customerUser;
    }

    public void setCustomerUser(User customerUser) {
        this.customerUser = customerUser;
    }

    public User getOfficeUser() {
        return officeUser;
    }

    public void setOfficeUser(User officeUser) {
        this.officeUser = officeUser;
    }

    public Address getAddress() {
        return address;
    }

    public void setAddress(Address address) {
        this.address = address;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public void setStatus(OrderStatus status) {
        this.status = status;
    }

    public String getPreviousState() {
        return previousState;
    }

    public void setPreviousState(String previousState) {
        this.previousState = previousState;
    }

    public Collection<OrderPosition> getOrderPositions() {
        return orderPositions;
    }

    public void setOrderPositions(Collection<OrderPosition> orderPositions) {
        this.orderPositions = orderPositions;
    }

    public Collection<OrderReturnBottle> getOrderReturnBottles() {
        return orderReturnBottles;
    }

    public void setOrderReturnBottles(Collection<OrderReturnBottle> orderReturnBottles) {
        this.orderReturnBottles = orderReturnBottles;
    }

    public Collection<OrderComment> getOrderComments() {
        return orderComments;
    }

    public void setOrderComments(Collection<OrderComment> orderComments) {
        this.orderComments = orderComments;
    }

    public Trip getTrip() {
        return trip;
    }

    public void setTrip(Trip trip) {
        this.trip = trip;
    }

    public int getWeight() {
        return this.getOrderPositions().stream()
                .map (op -> op.getBottleType().getWeight() * op.getQuantity())
                .reduce(0, Integer::sum);
    }

    public BigDecimal getSum() {
        return this.getOrderPositions().stream()
                .map ( op -> op.getPrice().multiply( BigDecimal.valueOf( op.getQuantity() ) ) )
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public static Order create() {
        Order order = new Order();
        order.setStatus(OrderStatus.NEW);
        order.setCreated(new Date());
        order.setUpdated(new Date());
        return order;
    }
}
