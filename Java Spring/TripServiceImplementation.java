package pro.gastex.app.service.implementation;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import pro.gastex.app.dto.company.TripDto;
import pro.gastex.app.enums.OrderStatus;
import pro.gastex.app.enums.TripStatus;
import pro.gastex.app.model.BaseEntity;
import pro.gastex.app.model.company.Auto;
import pro.gastex.app.model.company.Order;
import pro.gastex.app.model.company.Trip;
import pro.gastex.app.model.company.User;
import pro.gastex.app.repository.company.OrderRepository;
import pro.gastex.app.repository.company.TripRepository;
import pro.gastex.app.service.TripService;

import javax.persistence.criteria.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

import static pro.gastex.app.model.company.Auto.AUTO_ANY;
import static pro.gastex.app.model.company.Customer.CUSTOMER_ANY;
import static pro.gastex.app.model.company.Office.OFFICE_ANY;
import static pro.gastex.app.model.company.User.USER_ANY;

@Service
public class TripServiceImplementation implements TripService {

    private final TripRepository tripRepository;
    private final OrderRepository orderRepository;

    public TripServiceImplementation(TripRepository tripRepository,
                                     OrderRepository orderRepository) {
        this.tripRepository = tripRepository;
        this.orderRepository = orderRepository;
    }

    @Override
    public Trip findById(Long id) {
        return tripRepository.findById(id).orElse(null);
    }

    @Override
    public void save(Trip trip) {
        tripRepository.save(trip);
    }

    @Override
    public Page<Trip> findAll(
            Date dateFrom,
            Date dateTo,
            Long officeId,
            Long autoId,
            Long customerId,
            TripStatus status,
            boolean showFinished,
            Pageable pageable) {

        Specification<Trip> specDateFrom = new Specification<Trip>() {
            @Override
            public Predicate toPredicate(Root<Trip> tripRoot, CriteriaQuery<?> query, CriteriaBuilder criteriaBuilder) {
                if (dateFrom != null) {
                    return criteriaBuilder.greaterThanOrEqualTo( tripRoot.get("dueDate"), dateFrom);
                }
                return criteriaBuilder.and();
            }
        };

        Specification<Trip> specDateTo = new Specification<Trip>() {
            @Override
            public Predicate toPredicate(Root<Trip> tripRoot, CriteriaQuery<?> query, CriteriaBuilder criteriaBuilder) {
                if (dateTo != null) {
                    Date nextDay = new Date( dateTo.getTime() + (1000 * 60 * 60 * 24) );
                    return criteriaBuilder.lessThan( tripRoot.get("dueDate"), nextDay);
                }
                return criteriaBuilder.and();
            }
        };

        Specification<Trip> specOfficeId = new Specification<Trip>() {
            @Override
            public Predicate toPredicate(Root<Trip> tripRoot, CriteriaQuery<?> query, CriteriaBuilder criteriaBuilder) {
                if (!officeId.equals(OFFICE_ANY) ) {
                    return criteriaBuilder.equal( tripRoot.get("office"), officeId);
                }
                return criteriaBuilder.and();
            }
        };

        Specification<Trip> specAutoId = new Specification<Trip>() {
            @Override
            public Predicate toPredicate(Root<Trip> tripRoot, CriteriaQuery<?> query, CriteriaBuilder criteriaBuilder) {
                if (!autoId.equals(AUTO_ANY) ) {
                    return criteriaBuilder.equal( tripRoot.get("auto"), autoId);
                }
                return criteriaBuilder.and();
            }
        };

        Specification<Trip> specCustomerId = new Specification<Trip>() {
            @Override
            public Predicate toPredicate(Root<Trip> tripRoot, CriteriaQuery<?> query, CriteriaBuilder criteriaBuilder) {
                if (!customerId.equals(CUSTOMER_ANY) ) {
                    Join<Trip, Order> customerJoin = tripRoot.join("orders", JoinType.LEFT);
                    return criteriaBuilder.equal( customerJoin.get("customer"), customerId);
                }
                return criteriaBuilder.and();
            }
        };

        Specification<Trip> specTripStatus = new Specification<Trip>() {
            @Override
            public Predicate toPredicate(Root<Trip> tripRoot, CriteriaQuery<?> query, CriteriaBuilder criteriaBuilder) {
                if (!status.equals(TripStatus.NOT_SET)) {
                    return criteriaBuilder.equal( tripRoot.get("status"), status);
                }
                return criteriaBuilder.and();
            }
        };

        Specification<Trip> specShowFinished = new Specification<Trip>() {
            @Override
            public Predicate toPredicate(Root<Trip> tripRoot, CriteriaQuery<?> query, CriteriaBuilder criteriaBuilder) {
                if (showFinished) {
                    return criteriaBuilder.equal( tripRoot.get("status"), TripStatus.FINISHED);
                }
                return criteriaBuilder.notEqual( tripRoot.get("status"), TripStatus.FINISHED);
            }
        };

        return tripRepository.findAll(
                specDateFrom.and(
                        specDateTo.and(
                            specOfficeId.and(
                                specAutoId.and(
                                    specCustomerId.and(
                                        specTripStatus.and(
                                                specShowFinished
                                        ) ) ) )  ) ), pageable);
    }

    @Override
    public Page<Trip> select(Date dateFrom, Date dateTo, Long officeId, Long workerId,
                             Long autoId, List<TripStatus> statuses, Pageable pageable) {

        Specification<Trip> specDateFrom = new Specification<Trip>() {
            @Override
            public Predicate toPredicate(Root<Trip> tripRoot, CriteriaQuery<?> query, CriteriaBuilder criteriaBuilder) {
                if (dateFrom != null) {
                    return criteriaBuilder.greaterThanOrEqualTo( tripRoot.get("created"), dateFrom);
                }
                return criteriaBuilder.and();
            }
        };

        Specification<Trip> specDateTo = new Specification<Trip>() {
            @Override
            public Predicate toPredicate(Root<Trip> tripRoot, CriteriaQuery<?> query, CriteriaBuilder criteriaBuilder) {
                if (dateTo != null) {
                    Date nextDay = new Date( dateTo.getTime() + (1000 * 60 * 60 * 24) );
                    return criteriaBuilder.lessThan( tripRoot.get("created"), nextDay);
                }
                return criteriaBuilder.and();
            }
        };

        Specification<Trip> specOfficeId = new Specification<Trip>() {
            @Override
            public Predicate toPredicate(Root<Trip> tripRoot, CriteriaQuery<?> query, CriteriaBuilder criteriaBuilder) {
                if (!officeId.equals(OFFICE_ANY) ) {
                    return criteriaBuilder.equal( tripRoot.get("office"), officeId);
                }
                return criteriaBuilder.and();
            }
        };

        Specification<Trip> specWorkerId = new Specification<Trip>() {
            @Override
            public Predicate toPredicate(Root<Trip> tripRoot, CriteriaQuery<?> query, CriteriaBuilder criteriaBuilder) {
                if (!workerId.equals(USER_ANY) ) {
                    return criteriaBuilder.equal( tripRoot.get("worker"), workerId);
                }
                return criteriaBuilder.and();
            }
        };

        Specification<Trip> specAutoId = new Specification<Trip>() {
            @Override
            public Predicate toPredicate(Root<Trip> tripRoot, CriteriaQuery<?> query, CriteriaBuilder criteriaBuilder) {
                if (!autoId.equals(AUTO_ANY) ) {
                    return criteriaBuilder.equal( tripRoot.get("auto"), autoId);
                }
                return criteriaBuilder.and();
            }
        };

        Specification<Trip> specTripStatuses = new Specification<Trip>() {
            @Override
            public Predicate toPredicate(Root<Trip> tripRoot, CriteriaQuery<?> query, CriteriaBuilder criteriaBuilder) {
                List<TripStatus> notSet = Arrays.asList(TripStatus.NOT_SET);
                if (!statuses.equals(notSet)) {
                    return tripRoot.get("status").in(statuses);
                }
                return criteriaBuilder.and();
            }
        };

        return tripRepository.findAll(
                specDateFrom
                        .and(specDateTo
                                .and(specOfficeId
                                        .and(specWorkerId
                                                .and(specAutoId
                                                        .and(specTripStatuses))))),
                pageable );
    }

    @Override
    public boolean checkIsTripComplete(Trip trip) {
        return trip.getOrders().stream()
                .allMatch(order -> order.getStatus().equals(OrderStatus.DELIVERED));
    }

    @Override
    public boolean checkTripOrdersChange(Trip trip, TripDto requestDto) {
        Map<Long, OrderStatus> prevTripOrders = trip.getOrders().stream()
                .collect(Collectors.toMap(BaseEntity::getId, Order::getStatus));

        Map<Long, OrderStatus> currTripOrders = Arrays.stream(requestDto.getOrderIds())
                .map( id -> orderRepository.findById(id).orElse(null) )
                .filter(Objects::nonNull)
                .collect(Collectors.toMap(Order::getId, Order::getStatus));

        if ( !prevTripOrders.keySet().equals(currTripOrders.keySet()) ) {
            return true;
        }
        return !prevTripOrders.entrySet().stream()
                .allMatch( e -> e.getValue().equals( currTripOrders.get(e.getKey()) ) );
    }

    @Override
    public boolean checkAutoOverload(Auto auto, TripDto tripDto) {
        AtomicInteger tripTotalWeight = new AtomicInteger(0);
        Arrays.stream(tripDto.getOrderIds()).forEach(
                oid -> {
                    Optional<Order> optionalOrder = orderRepository.findById(oid);
                    optionalOrder.ifPresent(
                            order -> tripTotalWeight.getAndAdd(order.getWeight())
                    );
                } );
        return tripTotalWeight.get() > auto.getCapacity();
    }

}
