package com.edgechain.lib.context.services.impl;

import com.edgechain.lib.context.HistoryContext;
import com.edgechain.lib.context.repository.RedisHistoryContextRepository;
import com.edgechain.lib.context.services.HistoryContextService;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class RedisHistoryContextService implements HistoryContextService {

    @Autowired private RedisHistoryContextRepository redisHistoryContextRepository;

    @Override
    public Single<HistoryContext> put(String value) {


        return Single.create(emitter ->  {
            try{
                HistoryContext context = new HistoryContext();
                context.setValue(value);

                HistoryContext returnValue = redisHistoryContextRepository.save(context);
                System.out.println(returnValue);

                emitter.onSuccess(returnValue);
            }catch (final Exception e){
                emitter.onError(e);
            }
        });
    }

    @Override
    public Single<HistoryContext> findById(String id) {
        return Single.create(emitter -> emitter.onSuccess(
                redisHistoryContextRepository.findById(id).orElseThrow(() -> new RuntimeException("Context id is not found"))
        ));
    }

    @Override
    public Completable deleteAllByIds(List<String> ids) {
        return Completable.create(emitter -> {
            try{
                redisHistoryContextRepository.deleteAllById(ids);
                emitter.onComplete();
            }catch (final Exception e){
                emitter.onError(e);
            }
        });
    }

}
