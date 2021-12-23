package pro.gastex.app.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import pro.gastex.app.dto.company.TripDto;
import pro.gastex.app.enums.TripStatus;
import pro.gastex.app.model.company.Auto;
import pro.gastex.app.model.company.Order;
import pro.gastex.app.model.company.Trip;
import pro.gastex.app.model.company.User;

import java.util.Date;
import java.util.List;

public interface TripService {

    Trip findById(Long id);

    void save(Trip trip);

    Page<Trip> findAll(Date dateFrom,
                       Date dateTo,
                       Long officeId,
                       Long autoId,
                       Long customerId,
                       TripStatus status,
                       boolean showFinished,
                       Pageable pageable);

    Page<Trip> select(Date dateFrom, Date dateTo, Long officeId, Long workerId, Long autoId, List<TripStatus> statuses, Pageable pageable);

    boolean checkTripOrdersChange(Trip trip, TripDto requestDto);

    boolean checkAutoOverload(Auto auto, TripDto tripDto);

    boolean checkIsTripComplete(Trip trip);
}
