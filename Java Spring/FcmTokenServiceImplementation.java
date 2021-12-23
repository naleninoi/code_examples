package pro.gastex.fcm.service.implementation;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pro.gastex.app.model.company.User;
import pro.gastex.fcm.model.FcmToken;
import pro.gastex.fcm.repository.FcmTokenRepository;
import pro.gastex.fcm.service.FcmTokenService;

import java.util.Date;
import java.util.List;

@Service
public class FcmTokenServiceImplementation implements FcmTokenService {

    private final FcmTokenRepository tokenRepository;

    public FcmTokenServiceImplementation(FcmTokenRepository tokenRepository) {
        this.tokenRepository = tokenRepository;
    }

    @Override
    public void save(FcmToken fcmToken) {
        tokenRepository.save(fcmToken);
    }

    @Override
    public void update(FcmToken fcmToken) {
        fcmToken.setActive(true);
        fcmToken.setUpdated(new Date());
        tokenRepository.save(fcmToken);
    }

    @Override
    public FcmToken addDeviceToUser(String deviceToken, User user) {
        FcmToken fcmToken = FcmToken.create();
        fcmToken.setDeviceToken(deviceToken);
        fcmToken.setUser(user);
        tokenRepository.save(fcmToken);
        return fcmToken;
    }

    @Override
    public List<FcmToken> findUserDevices(User user) {
        return tokenRepository.findByUserAndIsActiveIsTrue(user);
    }

    @Override
    public FcmToken findByUserAndDeviceToken(User user, String deviceToken) {
        return tokenRepository.findByUserAndDeviceToken(user, deviceToken).orElse(null);
    }

    @Override
    @Transactional
    public void inactivateOutdatedTokensForUser(User user) {
        List<FcmToken> userTokens = findUserDevices(user);
        userTokens.forEach(fcmToken -> {
            if (fcmToken.isExpired()) {
                fcmToken.setActive(false);
                tokenRepository.save(fcmToken);
            }
        });
    }
}
