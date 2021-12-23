package pro.gastex.fcm.service.implementation;

import org.springframework.stereotype.Service;
import pro.gastex.app.model.company.*;
import pro.gastex.fcm.enums.FcmTopicType;
import pro.gastex.fcm.model.FcmTopic;
import pro.gastex.fcm.repository.FcmTopicRepository;
import pro.gastex.fcm.service.FcmTopicService;

@Service
public class FcmTopicServiceImplementation implements FcmTopicService {

    private final FcmTopicRepository topicRepository;

    public FcmTopicServiceImplementation(FcmTopicRepository topicRepository) {
        this.topicRepository = topicRepository;
    }

    @Override
    public void save(FcmTopic fcmTopic) {
        topicRepository.save(fcmTopic);
    }

    @Override
    public FcmTopic findFcmTopic(Office office) {
        return topicRepository.findByTopicTypeAndTopicTypeId(FcmTopicType.OFFICE, office.getId()).orElse(null);
    }

    @Override
    public FcmTopic findFcmTopic(Customer customer) {
        return topicRepository.findByTopicTypeAndTopicTypeId(FcmTopicType.CUSTOMER, customer.getId()).orElse(null);
    }

    @Override
    public FcmTopic findFcmTopic(Order order) {
        return topicRepository.findByTopicTypeAndTopicTypeId(FcmTopicType.ORDER, order.getId()).orElse(null);
    }

    @Override
    public FcmTopic findFcmTopic(Trip trip) {
        return topicRepository.findByTopicTypeAndTopicTypeId(FcmTopicType.TRIP, trip.getId()).orElse(null);
    }

    @Override
    public FcmTopic findFcmTopic(User user) {
        return topicRepository.findByTopicTypeAndTopicTypeId(FcmTopicType.USER, user.getId()).orElse(null);
    }

    @Override
    public FcmTopic createFcmTopic(Office office) {
        FcmTopic fcmTopic = FcmTopic.create();
        fcmTopic.setTopicType(FcmTopicType.OFFICE);
        fcmTopic.setTopicTypeId(office.getId());
        return fcmTopic;
    }

    @Override
    public FcmTopic createFcmTopic(Customer customer) {
        FcmTopic fcmTopic = FcmTopic.create();
        fcmTopic.setTopicType(FcmTopicType.CUSTOMER);
        fcmTopic.setTopicTypeId(customer.getId());
        return fcmTopic;
    }

    @Override
    public FcmTopic createFcmTopic(Order order) {
        FcmTopic fcmTopic = FcmTopic.create();
        fcmTopic.setTopicType(FcmTopicType.ORDER);
        fcmTopic.setTopicTypeId(order.getId());
        return fcmTopic;
    }

    @Override
    public FcmTopic createFcmTopic(Trip trip) {
        FcmTopic fcmTopic = FcmTopic.create();
        fcmTopic.setTopicType(FcmTopicType.TRIP);
        fcmTopic.setTopicTypeId(trip.getId());
        return fcmTopic;
    }

    @Override
    public FcmTopic createFcmTopic(User user) {
        FcmTopic fcmTopic = FcmTopic.create();
        fcmTopic.setTopicType(FcmTopicType.USER);
        fcmTopic.setTopicTypeId(user.getId());
        return fcmTopic;
    }
}
