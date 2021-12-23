package pro.gastex.app.enums;

public enum OrderStatus {

    NOT_SET(""),

    NEW("NEW"),
    PROCESSING("PROCESSING"),
    ON_WAY("ON_WAY"),
    DELIVERED("DELIVERED"),
    CANCELLED("CANCELLED"),
    REFUSED("REFUSED")
    ;

    private final String orderStatusName;

    OrderStatus(String orderStatusName) {
        this.orderStatusName = orderStatusName;
    }

    @Override
    public String toString() {
        return orderStatusName;
    }

    public static boolean contains(String test) {
        for (OrderStatus c : OrderStatus.values()) {
            if (c.name().equals(test)) {
                return true;
            }
        }
        return false;
    }

    public boolean isTerminal() {
        switch (this) {
            case DELIVERED:
            case REFUSED:
            case CANCELLED:
                return true;
            default:
                return false;
        }
    }

}
