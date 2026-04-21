import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Card,
  Chip,
  FormControl,
  InputAdornment,
  MenuItem,
  Select,
  TablePagination,
  TextField,
  Typography,
  Button,
  alpha,
  Stack,
  Dialog,
  DialogTitle,
  DialogActions,
  Tab,
  Tabs,
  Badge,
  useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Page } from '../components/layout';
import { TopMinersTable, SEO, WatchlistButton } from '../components';
import {
  DataTable,
  type DataTableColumn,
} from '../components/common/DataTable';
import { useAllMiners, useAllPrs, useReposAndWeights, useIssues } from '../api';
import { mapAllMinersToStats } from '../utils/minerMapper';
import {
  useWatchlist,
  useWatchlistCounts,
  serializePRKey,
  type WatchlistCategory,
} from '../hooks/useWatchlist';
import { isMergedPr, isClosedUnmergedPr } from '../utils/prStatus';
import { getIssueStatusMeta } from '../utils/issueStatus';
import { formatTokenAmount } from '../utils/format';
import { STATUS_COLORS, TEXT_OPACITY } from '../theme';
import type { Repository, CommitLog } from '../api/models/Dashboard';
import type { IssueBounty } from '../api/models/Issues';

const VALID_ROWS = [10, 25, 50];

const TAB_ORDER: readonly WatchlistCategory[] = [
  'miners',
  'repos',
  'bounties',
  'prs',
] as const;

const TAB_LABELS: Record<WatchlistCategory, string> = {
  miners: 'Miners',
  repos: 'Repositories',
  bounties: 'Bounties',
  prs: 'Pull Requests',
};

const TAB_NOUN: Record<WatchlistCategory, { single: string; plural: string }> =
  {
    miners: { single: 'miner', plural: 'miners' },
    repos: { single: 'repository', plural: 'repositories' },
    bounties: { single: 'bounty', plural: 'bounties' },
    prs: { single: 'pull request', plural: 'pull requests' },
  };

const TAB_DISCOVERY: Record<
  WatchlistCategory,
  { label: string; path: string; hint: string }
> = {
  miners: {
    label: 'leaderboard',
    path: '/top-miners',
    hint: 'Browse the leaderboard and star miners you want to track.',
  },
  repos: {
    label: 'repositories',
    path: '/repositories',
    hint: 'Open a repository and star it to follow its activity here.',
  },
  bounties: {
    label: 'bounties',
    path: '/bounties',
    hint: 'Open a bounty and star it to track its submissions here.',
  },
  prs: {
    label: 'repositories',
    path: '/repositories',
    hint: 'Open a pull request and star it to monitor its scoring here.',
  },
};

const tabFromParam = (param: string | null): WatchlistCategory =>
  TAB_ORDER.includes(param as WatchlistCategory)
    ? (param as WatchlistCategory)
    : 'miners';

const WatchlistPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = tabFromParam(searchParams.get('tab'));

  // Single subscription for tab badges; per-tab content uses useWatchlist
  // scoped to its own category via the *List subcomponents below.
  const counts = useWatchlistCounts();
  const { ids, count, clear } = useWatchlist(activeTab);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isEmpty = count === 0;
  const noun = TAB_NOUN[activeTab];
  const discovery = TAB_DISCOVERY[activeTab];

  const handleClear = () => {
    clear();
    setConfirmOpen(false);
  };

  const handleTabChange = (_event: React.SyntheticEvent, next: unknown) => {
    const validated = tabFromParam(String(next));
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (validated === 'miners') {
          params.delete('tab');
        } else {
          params.set('tab', validated);
        }
        return params;
      },
      { replace: true },
    );
  };

  return (
    <Page title="Watchlist">
      <SEO
        title="Watchlist"
        description="Your pinned miners, repositories, bounties, and pull requests on Gittensor."
      />
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 2, sm: 1.5 },
          py: { xs: 2, sm: 2, md: 2.5, lg: 3 },
          px: { xs: 2, sm: 2, md: 2.5, lg: 3 },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={2}
        >
          <Typography
            sx={{
              fontSize: '0.8rem',
              color: (t) => alpha(t.palette.text.primary, 0.5),
              lineHeight: 1.6,
            }}
          >
            Your watchlist — {count}{' '}
            {count === 1 ? `${noun.single} pinned` : `${noun.plural} pinned`}.
            Stored locally in this browser.
          </Typography>
          {count > 0 && (
            <Button
              size="small"
              onClick={() => setConfirmOpen(true)}
              sx={{
                fontSize: '0.75rem',
                textTransform: 'none',
                color: 'text.secondary',
              }}
            >
              Clear {noun.plural}
            </Button>
          )}
        </Stack>

        <Box sx={{ borderBottom: '1px solid', borderColor: 'border.light' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 40,
              '& .MuiTab-root': {
                minHeight: 40,
                fontSize: '0.83rem',
                fontWeight: 500,
                textTransform: 'none',
                color: 'text.secondary',
                '&.Mui-selected': { color: 'primary.main' },
              },
            }}
          >
            {TAB_ORDER.map((cat) => (
              <Tab
                key={cat}
                value={cat}
                label={
                  <Badge
                    badgeContent={counts[cat]}
                    color="primary"
                    sx={{
                      '& .MuiBadge-badge': {
                        fontSize: '0.65rem',
                        minWidth: 18,
                        height: 18,
                      },
                    }}
                  >
                    <Box sx={{ pr: counts[cat] > 0 ? 1.5 : 0 }}>
                      {TAB_LABELS[cat]}
                    </Box>
                  </Badge>
                }
              />
            ))}
          </Tabs>
        </Box>

        {isEmpty ? (
          <Box
            sx={{
              py: 8,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              alignItems: 'center',
              color: 'text.secondary',
            }}
          >
            <Typography sx={{ fontSize: '0.95rem' }}>
              No watched {noun.plural} yet.
            </Typography>
            <Typography
              sx={{
                fontSize: '0.8rem',
                maxWidth: 480,
                color: (t) => alpha(t.palette.text.primary, 0.5),
              }}
            >
              {discovery.hint} Pinned items appear here across reloads and tabs.
            </Typography>
            <Button
              component={RouterLink}
              to={discovery.path}
              variant="outlined"
              size="small"
              sx={{ textTransform: 'none', mt: 1 }}
            >
              Go to {discovery.label}
            </Button>
          </Box>
        ) : activeTab === 'miners' ? (
          <MinersList itemKeys={ids} />
        ) : activeTab === 'repos' ? (
          <ReposList itemKeys={ids} />
        ) : activeTab === 'bounties' ? (
          <BountiesList itemKeys={ids} />
        ) : (
          <PRsList itemKeys={ids} />
        )}
      </Box>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        PaperProps={{
          sx: (t) => ({
            backgroundColor: t.palette.background.default,
            border: `1px solid ${t.palette.border.light}`,
            borderRadius: 3,
            backgroundImage: 'none',
            p: 3,
          }),
        }}
      >
        <DialogTitle
          sx={{
            fontSize: '0.9rem',
            fontWeight: 600,
            p: 0,
            mb: 3,
          }}
        >
          Clear all {count} pinned {count === 1 ? noun.single : noun.plural}?
        </DialogTitle>
        <DialogActions sx={{ p: 0 }}>
          <Button
            onClick={() => setConfirmOpen(false)}
            sx={{
              textTransform: 'none',
              fontSize: '0.8rem',
              color: (t) => alpha(t.palette.text.primary, 0.7),
              border: '1px solid',
              borderColor: 'border.light',
              borderRadius: 2,
              px: 2,
              '&:hover': {
                color: 'text.primary',
                borderColor: 'border.medium',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleClear}
            sx={{
              textTransform: 'none',
              fontSize: '0.8rem',
              color: 'common.white',
              backgroundColor: 'error.main',
              borderRadius: 2,
              px: 2,
              '&:hover': {
                backgroundColor: 'error.dark',
              },
            }}
          >
            Clear {noun.plural}
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  );
};

interface WatchlistTableHeaderProps {
  rowsPerPage: number;
  onRowsPerPageChange: (rows: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
}

const WatchlistTableHeader: React.FC<WatchlistTableHeaderProps> = ({
  rowsPerPage,
  onRowsPerPageChange,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
}) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderBottom: `1px solid ${theme.palette.border.light}`,
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <FormControl size="small">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="body2"
              sx={{
                color: alpha(
                  theme.palette.common.white,
                  TEXT_OPACITY.secondary,
                ),
                fontSize: '0.8rem',
              }}
            >
              Rows:
            </Typography>
            <Select
              value={rowsPerPage}
              onChange={(e) => onRowsPerPageChange(e.target.value as number)}
              sx={{
                color: theme.palette.text.primary,
                backgroundColor: alpha(theme.palette.common.black, 0.4),
                fontSize: '0.8rem',
                height: '36px',
                borderRadius: 2,
                minWidth: '80px',
                '& fieldset': { borderColor: theme.palette.border.light },
                '&:hover fieldset': {
                  borderColor: theme.palette.border.medium,
                },
                '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                '& .MuiSelect-select': { py: 0.75 },
              }}
            >
              {VALID_ROWS.map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </Select>
          </Box>
        </FormControl>

        <TextField
          placeholder={searchPlaceholder}
          size="small"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon
                  sx={{
                    color: alpha(
                      theme.palette.common.white,
                      TEXT_OPACITY.muted,
                    ),
                    fontSize: '1rem',
                  }}
                />
              </InputAdornment>
            ),
          }}
          sx={{
            width: '200px',
            '& .MuiOutlinedInput-root': {
              color: theme.palette.text.primary,
              backgroundColor: alpha(theme.palette.common.black, 0.4),
              fontSize: '0.8rem',
              height: '36px',
              borderRadius: 2,
              '& fieldset': { borderColor: theme.palette.border.light },
              '&:hover fieldset': {
                borderColor: theme.palette.border.medium,
              },
              '&.Mui-focused fieldset': { borderColor: 'primary.main' },
            },
          }}
        />
      </Box>
    </Box>
  );
};

interface WatchlistCardWrapperProps {
  children: React.ReactNode;
}

const WatchlistCardWrapper: React.FC<WatchlistCardWrapperProps> = ({
  children,
}) => {
  const theme = useTheme();
  return (
    <Card
      sx={{
        backgroundColor: 'background.default',
        border: `1px solid ${theme.palette.border.light}`,
        borderRadius: 3,
        overflow: 'hidden',
      }}
      elevation={0}
    >
      {children}
    </Card>
  );
};

const MinersList: React.FC<{ itemKeys: string[] }> = ({ itemKeys }) => {
  const { data: allMinersStats, isLoading } = useAllMiners();
  const watchedSet = useMemo(() => new Set(itemKeys), [itemKeys]);

  const minerStats = useMemo(() => {
    const all = mapAllMinersToStats(allMinersStats ?? []);
    return all
      .filter((m) => watchedSet.has(m.githubId))
      .map((m) => ({
        ...m,
        // Watchlist cards should be enabled if miner is eligible for either
        // OSS contributions or Issue Discoveries.
        isEligible: Boolean(m.ossIsEligible || m.discoveriesIsEligible),
      }));
  }, [allMinersStats, watchedSet]);

  return (
    <Box sx={{ width: '100%' }}>
      <TopMinersTable
        miners={minerStats}
        isLoading={isLoading}
        getMinerHref={(m) =>
          `/miners/details?githubId=${encodeURIComponent(m.githubId)}`
        }
        linkState={{ backLabel: 'Back to Watchlist' }}
        variant="watchlist"
        showDualEligibilityBadges
      />
    </Box>
  );
};

const ReposList: React.FC<{ itemKeys: string[] }> = ({ itemKeys }) => {
  const theme = useTheme();
  const { data: repos, isLoading } = useReposAndWeights();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');

  const items = useMemo(() => {
    if (!repos) return [];
    const set = new Set(itemKeys.map((k) => k.toLowerCase()));
    return repos.filter((r) => set.has(r.fullName.toLowerCase()));
  }, [repos, itemKeys]);

  const filtered = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((r) => r.fullName.toLowerCase().includes(q));
  }, [items, searchQuery]);

  useEffect(() => {
    setPage(0);
  }, [searchQuery]);

  const paginated = useMemo(() => {
    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const columns = useMemo<DataTableColumn<Repository>[]>(
    () => [
      {
        key: 'repository',
        header: 'Repository',
        renderCell: (repo) => (
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}
          >
            <Avatar
              src={`https://avatars.githubusercontent.com/${repo.owner}`}
              sx={{ width: 24, height: 24, borderRadius: 1, flexShrink: 0 }}
            />
            <Typography
              sx={{
                fontSize: '0.85rem',
                color: STATUS_COLORS.info,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {repo.fullName}
            </Typography>
          </Box>
        ),
      },
      {
        key: 'weight',
        header: 'Weight',
        width: '140px',
        align: 'right',
        renderCell: (repo) => (
          <Typography
            sx={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: STATUS_COLORS.merged,
            }}
          >
            {parseFloat(String(repo.weight)).toFixed(2)}
          </Typography>
        ),
      },
      {
        key: 'watch',
        header: '',
        width: '60px',
        align: 'center',
        renderCell: (repo) => (
          <WatchlistButton category="repos" itemKey={repo.fullName} />
        ),
      },
    ],
    [],
  );

  return (
    <WatchlistCardWrapper>
      <DataTable<Repository>
        columns={columns}
        rows={paginated}
        getRowKey={(repo) => repo.fullName}
        getRowHref={(repo) =>
          `/miners/repository?name=${encodeURIComponent(repo.fullName)}`
        }
        linkState={{ backLabel: 'Back to Watchlist' }}
        isLoading={isLoading}
        minWidth="600px"
        header={
          <WatchlistTableHeader
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(n) => {
              setRowsPerPage(n);
              setPage(0);
            }}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search repositories..."
          />
        }
        emptyState={
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography
              sx={{
                color: alpha(theme.palette.common.white, TEXT_OPACITY.tertiary),
              }}
            >
              {searchQuery
                ? 'No repositories match your search'
                : 'No repositories found'}
            </Typography>
          </Box>
        }
        pagination={
          <TablePagination
            rowsPerPageOptions={[]}
            component="div"
            count={filtered.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_e, newPage) => setPage(newPage)}
            onRowsPerPageChange={() => {}}
            showFirstButton
            showLastButton
          />
        }
      />
    </WatchlistCardWrapper>
  );
};

const BountiesList: React.FC<{ itemKeys: string[] }> = ({ itemKeys }) => {
  const theme = useTheme();
  const { data: allIssues, isLoading } = useIssues();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');

  const items = useMemo(() => {
    if (!allIssues) return [];
    const set = new Set(itemKeys);
    return allIssues.filter((issue) => set.has(String(issue.id)));
  }, [allIssues, itemKeys]);

  const filtered = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (i) =>
        i.repositoryFullName.toLowerCase().includes(q) ||
        i.title?.toLowerCase().includes(q) ||
        String(i.issueNumber).includes(q),
    );
  }, [items, searchQuery]);

  useEffect(() => {
    setPage(0);
  }, [searchQuery]);

  const paginated = useMemo(() => {
    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const columns = useMemo<DataTableColumn<IssueBounty>[]>(
    () => [
      {
        key: 'id',
        header: 'ID',
        width: '60px',
        renderCell: (issue) => (
          <Typography
            sx={{
              fontSize: '0.8rem',
              color: alpha(theme.palette.common.white, 0.6),
            }}
          >
            #{issue.id}
          </Typography>
        ),
      },
      {
        key: 'repository',
        header: 'Repository',
        width: '200px',
        cellSx: { overflow: 'hidden' },
        renderCell: (issue) => (
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}
          >
            <Avatar
              src={`https://avatars.githubusercontent.com/${issue.repositoryFullName.split('/')[0]}`}
              sx={{ width: 24, height: 24, borderRadius: 1, flexShrink: 0 }}
            />
            <Typography
              sx={{
                fontSize: '0.85rem',
                color: STATUS_COLORS.info,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {issue.repositoryFullName}
            </Typography>
          </Box>
        ),
      },
      {
        key: 'issue',
        header: 'Issue',
        renderCell: (issue) => (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {issue.title && (
              <Typography
                sx={{
                  fontSize: '0.85rem',
                  color: 'text.primary',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {issue.title}
              </Typography>
            )}
            <Typography
              sx={{
                fontSize: '0.75rem',
                color: alpha(theme.palette.common.white, TEXT_OPACITY.tertiary),
              }}
            >
              #{issue.issueNumber}
            </Typography>
          </Box>
        ),
      },
      {
        key: 'bounty',
        header: 'Bounty',
        width: '120px',
        align: 'right',
        renderCell: (issue) => (
          <Typography
            sx={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: STATUS_COLORS.merged,
            }}
          >
            {formatTokenAmount(issue.bountyAmount)} ل
          </Typography>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        width: '110px',
        align: 'center',
        renderCell: (issue) => {
          const meta = getIssueStatusMeta(issue.status);
          return (
            <Chip
              label={meta.text}
              size="small"
              sx={{
                fontSize: '0.7rem',
                fontWeight: 600,
                backgroundColor: meta.bgColor,
                color: meta.color,
                border: `1px solid ${meta.color}40`,
              }}
            />
          );
        },
      },
      {
        key: 'watch',
        header: '',
        width: '60px',
        align: 'center',
        renderCell: (issue) => (
          <WatchlistButton category="bounties" itemKey={String(issue.id)} />
        ),
      },
    ],
    [theme],
  );

  return (
    <WatchlistCardWrapper>
      <DataTable<IssueBounty>
        columns={columns}
        rows={paginated}
        getRowKey={(issue) => issue.id}
        getRowHref={(issue) => `/bounties/details?id=${issue.id}`}
        linkState={{ backLabel: 'Back to Watchlist' }}
        isLoading={isLoading}
        minWidth="800px"
        header={
          <WatchlistTableHeader
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(n) => {
              setRowsPerPage(n);
              setPage(0);
            }}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search bounties..."
          />
        }
        emptyState={
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography
              sx={{
                color: alpha(theme.palette.common.white, TEXT_OPACITY.tertiary),
              }}
            >
              {searchQuery
                ? 'No bounties match your search'
                : 'No bounties found'}
            </Typography>
          </Box>
        }
        pagination={
          <TablePagination
            rowsPerPageOptions={[]}
            component="div"
            count={filtered.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_e, newPage) => setPage(newPage)}
            onRowsPerPageChange={() => {}}
            showFirstButton
            showLastButton
          />
        }
      />
    </WatchlistCardWrapper>
  );
};

const PRsList: React.FC<{ itemKeys: string[] }> = ({ itemKeys }) => {
  const theme = useTheme();
  const { data: allPrs, isLoading } = useAllPrs();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');

  const items = useMemo(() => {
    if (!allPrs) return [];
    const set = new Set(itemKeys);
    return allPrs.filter((pr) =>
      set.has(serializePRKey(pr.repository, pr.pullRequestNumber)),
    );
  }, [allPrs, itemKeys]);

  const filtered = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (pr) =>
        pr.repository.toLowerCase().includes(q) ||
        pr.pullRequestTitle.toLowerCase().includes(q) ||
        pr.author.toLowerCase().includes(q) ||
        String(pr.pullRequestNumber).includes(q),
    );
  }, [items, searchQuery]);

  useEffect(() => {
    setPage(0);
  }, [searchQuery]);

  const paginated = useMemo(() => {
    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const columns = useMemo<DataTableColumn<CommitLog>[]>(
    () => [
      {
        key: 'pr',
        header: 'Pull Request',
        renderCell: (pr) => (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography
              sx={{
                fontSize: '0.85rem',
                color: 'text.primary',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              #{pr.pullRequestNumber} {pr.pullRequestTitle}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.75rem',
                color: alpha(theme.palette.common.white, TEXT_OPACITY.tertiary),
              }}
            >
              {pr.repository} · {pr.author}
            </Typography>
          </Box>
        ),
      },
      {
        key: 'score',
        header: 'Score',
        width: '100px',
        align: 'right',
        renderCell: (pr) => (
          <Typography
            sx={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: alpha(theme.palette.common.white, 0.8),
            }}
          >
            {parseFloat(pr.score || '0').toFixed(2)}
          </Typography>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        width: '110px',
        align: 'center',
        renderCell: (pr) => {
          const merged = isMergedPr(pr);
          const closed = isClosedUnmergedPr(pr);
          const statusLabel = merged ? 'Merged' : closed ? 'Closed' : 'Open';
          const statusColor = merged
            ? STATUS_COLORS.merged
            : closed
              ? STATUS_COLORS.closed
              : STATUS_COLORS.open;
          return (
            <Chip
              label={statusLabel}
              size="small"
              sx={{
                fontSize: '0.7rem',
                fontWeight: 600,
                backgroundColor: alpha(statusColor, 0.12),
                color: statusColor,
                border: `1px solid ${statusColor}40`,
              }}
            />
          );
        },
      },
      {
        key: 'watch',
        header: '',
        width: '60px',
        align: 'center',
        renderCell: (pr) => (
          <WatchlistButton
            category="prs"
            itemKey={serializePRKey(pr.repository, pr.pullRequestNumber)}
          />
        ),
      },
    ],
    [theme],
  );

  return (
    <WatchlistCardWrapper>
      <DataTable<CommitLog>
        columns={columns}
        rows={paginated}
        getRowKey={(pr) => serializePRKey(pr.repository, pr.pullRequestNumber)}
        getRowHref={(pr) =>
          `/miners/pr?repo=${encodeURIComponent(pr.repository)}&number=${pr.pullRequestNumber}`
        }
        linkState={{ backLabel: 'Back to Watchlist' }}
        isLoading={isLoading}
        minWidth="700px"
        header={
          <WatchlistTableHeader
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(n) => {
              setRowsPerPage(n);
              setPage(0);
            }}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search pull requests..."
          />
        }
        emptyState={
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography
              sx={{
                color: alpha(theme.palette.common.white, TEXT_OPACITY.tertiary),
              }}
            >
              {searchQuery
                ? 'No pull requests match your search'
                : 'No pull requests found'}
            </Typography>
          </Box>
        }
        pagination={
          <TablePagination
            rowsPerPageOptions={[]}
            component="div"
            count={filtered.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_e, newPage) => setPage(newPage)}
            onRowsPerPageChange={() => {}}
            showFirstButton
            showLastButton
          />
        }
      />
    </WatchlistCardWrapper>
  );
};

export default WatchlistPage;
