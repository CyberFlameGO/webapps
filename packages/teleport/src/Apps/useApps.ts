/**
 * Copyright 2020-2022 Gravitational, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'react-router';
import { FetchStatus } from 'design/DataTable/types';
import useAttempt from 'shared/hooks/useAttemptNext';
import { AppsResponse } from 'teleport/services/apps';
import history from 'teleport/services/history';
import Ctx from 'teleport/teleportContext';
import getResourceUrlQueryParams, {
  ResourceUrlQueryParams,
} from 'teleport/getUrlQueryParams';
import useStickyClusterId from 'teleport/useStickyClusterId';
import { SortType } from 'teleport/components/ServersideSearchPanel';

export default function useApps(ctx: Ctx) {
  const canCreate = ctx.storeUser.getTokenAccess().create;
  const { search, pathname } = useLocation();
  const [startKeys, setStartKeys] = useState<string[]>([]);
  const [isAddAppVisible, setAppAddVisible] = useState(false);
  const { clusterId, isLeafCluster } = useStickyClusterId();
  const { attempt, setAttempt } = useAttempt('processing');
  const isEnterprise = ctx.isEnterprise;
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('');
  const [params, setParams] = useState<ResourceUrlQueryParams>(() =>
    getResourceUrlQueryParams(search)
  );

  const [results, setResults] = useState<AppsResponse>({
    apps: [],
    startKey: '',
    totalCount: 0,
  });

  const isSearchEmpty = !params?.query && !params?.search;

  const pageSize = 15;

  const from =
    results.totalCount > 0 ? (startKeys.length - 2) * pageSize + 1 : 0;
  const to = results.totalCount > 0 ? from + results.apps.length - 1 : 0;

  useEffect(() => {
    fetch();
  }, [clusterId, search]);

  function replaceHistory(path: string) {
    history.replace(path);
  }

  const hideAddApp = () => {
    setAppAddVisible(false);
    fetch();
  };

  const showAddApp = () => {
    setAppAddVisible(true);
  };

  function setSort(sort: SortType) {
    setParams({ ...params, sort });
  }

  function fetch() {
    setAttempt({ status: 'processing' });
    ctx.appService
      .fetchApps(clusterId, { ...params, limit: pageSize })
      .then(res => {
        setResults(res);
        setFetchStatus(res.startKey ? '' : 'disabled');
        setStartKeys([res.apps[0]?.id, res.startKey]);
        setAttempt({ status: 'success' });
      })
      .catch((err: Error) => {
        setAttempt({ status: 'failed', statusText: err.message });
        setResults({ ...results, apps: [], totalCount: 0 });
        setStartKeys(['']);
      });
  }

  const fetchNext = () => {
    setFetchStatus('loading');
    ctx.appService
      .fetchApps(clusterId, {
        ...params,
        limit: pageSize,
        startKey: results.startKey,
      })
      .then(res => {
        setResults({
          ...results,
          apps: res.apps,
          startKey: res.startKey,
        });
        setFetchStatus(res.startKey ? '' : 'disabled');
        setStartKeys([...startKeys, res.startKey]);
      })
      .catch((err: Error) => {
        setAttempt({ status: 'failed', statusText: err.message });
      });
  };

  const fetchPrev = () => {
    setFetchStatus('loading');
    ctx.appService
      .fetchApps(clusterId, {
        ...params,
        limit: pageSize,
        startKey: startKeys[startKeys.length - 3],
      })
      .then(res => {
        const tempStartKeys = startKeys;
        tempStartKeys.pop();
        setStartKeys(tempStartKeys);
        setResults({
          ...results,
          apps: res.apps,
          startKey: res.startKey,
        });
        setFetchStatus('');
      })
      .catch((err: Error) => {
        setAttempt({ status: 'failed', statusText: err.message });
      });
  };

  return {
    clusterId,
    isLeafCluster,
    isEnterprise,
    isAddAppVisible,
    hideAddApp,
    showAddApp,
    canCreate,
    attempt,
    results,
    fetchNext,
    fetchPrev,
    pageSize,
    from,
    to,
    params,
    setParams,
    startKeys,
    setSort,
    pathname,
    replaceHistory,
    fetchStatus,
    isSearchEmpty,
  };
}

export type State = ReturnType<typeof useApps>;
