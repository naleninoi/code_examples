package pro.gastex.app.model.company;

import java.io.Serializable;
import java.util.Objects;

public class OrderPositionId implements Serializable {
    private Long order;
    private Long bottleType;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        OrderPositionId that = (OrderPositionId) o;
        return Objects.equals(order, that.order) && Objects.equals(bottleType, that.bottleType);
    }

    @Override
    public int hashCode() {
        return Objects.hash(order, bottleType);
    }
}
