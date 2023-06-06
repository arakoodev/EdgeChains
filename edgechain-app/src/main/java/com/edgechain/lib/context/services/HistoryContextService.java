package com.edgechain.lib.context.services;

import com.edgechain.lib.context.HistoryContext;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;

import java.util.List;

public interface HistoryContextService {

    Single<HistoryContext> put(String value);
    Single<HistoryContext> findById(String id);
    Completable deleteAllByIds(List<String> ids);

}
