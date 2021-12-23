package pro.gastex.app.repository.company;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.stereotype.Repository;
import pro.gastex.app.enums.TripStatus;
import pro.gastex.app.model.company.Trip;
import pro.gastex.app.model.company.User;

import java.util.Collection;
import java.util.List;

@Repository
public interface TripRepository extends
        PagingAndSortingRepository<Trip, Long>,
        JpaRepository<Trip, Long> {

    Page<Trip> findAll(Specification<Trip> specification, Pageable pageable);
    List<Trip> findAllByWorkerAndStatusIn(User worker, List<TripStatus> statuses);

}
