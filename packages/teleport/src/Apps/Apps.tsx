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

import React from 'react';
import { Danger } from 'design/Alert';
import { Indicator, Box } from 'design';
import useTeleport from 'teleport/useTeleport';
import {
  FeatureBox,
  FeatureHeader,
  FeatureHeaderTitle,
} from 'teleport/components/Layout';
import Empty, { EmptyStateInfo } from 'teleport/components/Empty';
import AppList from './AppList';
import AddApp from './AddApp';
import useApps, { State } from './useApps';
import AgentButtonAdd from 'teleport/components/AgentButtonAdd';

export default function Container() {
  const ctx = useTeleport();
  const state = useApps(ctx);
  return <Apps {...state} />;
}

export function Apps(props: State) {
  const {
    clusterId,
    isLeafCluster,
    isAddAppVisible,
    showAddApp,
    hideAddApp,
    canCreate,
    attempt,
    results,
    fetchNext,
    fetchPrev,
    from,
    to,
    pageSize,
    params,
    setParams,
    startKeys,
    setSort,
    pathname,
    replaceHistory,
    fetchStatus,
    isSearchEmpty,
  } = props;

  const hasNoApps =
    attempt.status === 'success' && results.apps.length === 0 && isSearchEmpty;

  return (
    <FeatureBox>
      <FeatureHeader alignItems="center" justifyContent="space-between">
        <FeatureHeaderTitle>Applications</FeatureHeaderTitle>
        {!hasNoApps && (
          <AgentButtonAdd
            agent="application"
            beginsWithVowel={true}
            isLeafCluster={isLeafCluster}
            canCreate={canCreate}
            onClick={showAddApp}
          />
        )}
      </FeatureHeader>
      {attempt.status === 'processing' && (
        <Box textAlign="center" m={10}>
          <Indicator />
        </Box>
      )}
      {attempt.status === 'failed' && <Danger>{attempt.statusText} </Danger>}
      {attempt.status !== 'processing' && !hasNoApps && (
        <AppList
          apps={results.apps}
          fetchNext={fetchNext}
          fetchPrev={fetchPrev}
          fetchStatus={fetchStatus}
          from={from}
          to={to}
          totalCount={results.totalCount}
          pageSize={pageSize}
          params={params}
          setParams={setParams}
          startKeys={startKeys}
          setSort={setSort}
          pathname={pathname}
          replaceHistory={replaceHistory}
        />
      )}
      {hasNoApps && (
        <Empty
          clusterId={clusterId}
          canCreate={canCreate && !isLeafCluster}
          onClick={showAddApp}
          emptyStateInfo={emptyStateInfo}
        />
      )}
      {isAddAppVisible && <AddApp onClose={hideAddApp} />}
    </FeatureBox>
  );
}

const emptyStateInfo: EmptyStateInfo = {
  title: 'Add your first application to Teleport',
  byline:
    'Teleport Application Access provides secure access to internal applications.',
  docsURL: 'https://goteleport.com/docs/application-access/getting-started/',
  resourceType: 'application',
  readOnly: {
    title: 'No Applications Found',
    resource: 'applications',
  },
};
