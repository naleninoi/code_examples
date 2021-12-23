package pro.gastex.app.model.company;

import javax.persistence.*;
import java.io.Serializable;
import java.math.BigDecimal;

/*
Использование @IdClass смотри
https://stackoverflow.com/questions/38613755/java-lang-illegalargumentexception-expecting-idclass-mapping
*/


@Entity
@IdClass(OrderPositionId.class)
@Table(name = "order_positions")
public class OrderPosition implements Serializable {

    @Id
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn( name="order_id", referencedColumnName = "id")
    private Order order;

    @Id
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn( name="bottle_type_id", referencedColumnName = "id")
    private BottleType bottleType;

    @Column(name = "quantity")
    private int quantity;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn( name="bottle_price_id", referencedColumnName = "id")
    private BottlePrice bottlePrice;

    @Column(name = "bottle_price")
    private BigDecimal price;


    public Order getOrder() {
        return order;
    }

    public void setOrder(Order order) {
        this.order = order;
    }

    public BottleType getBottleType() {
        return bottleType;
    }

    public void setBottleType(BottleType bottleType) {
        this.bottleType = bottleType;
    }

    public int getQuantity() {
        return quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public BottlePrice getBottlePrice() {
        return bottlePrice;
    }

    public void setBottlePrice(BottlePrice bottlePrice) {
        this.bottlePrice = bottlePrice;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }
}
