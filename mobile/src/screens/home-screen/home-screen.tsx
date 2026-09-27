import { useLedgerAccess } from "@/common/hooks/use-ledger-access";
import { StyleSheet, View } from "react-native";
import { useMemo, useState } from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslations } from "@/common/hooks/use-translations";
import { useLedgerMeta } from "@/common/hooks/use-ledger-meta";
import { useBalanceSheet } from "@/screens/home-screen/hooks/use-balance-sheet";
import { useBalanceSheetBasis } from "@/screens/home-screen/hooks/use-balance-sheet-basis";
import { useLedgerPrices } from "@/common/hooks/use-ledger-prices";
import { useDisplayCurrency } from "@/common/hooks/use-display-currency";
import {
  selectAssetsSeries,
  selectLiabilitiesSeries,
  selectNetWorthHoldings,
  selectNetWorthSeries,
  selectSeriesValuation,
  type SheetSeries,
} from "@/screens/home-screen/selectors/select-balance-sheet-series";
import { formatHolding } from "@/common/balance-display";
import {
  costBasisLine,
  valuationStatus,
  type Valuation,
} from "@/common/valuation";
import { ValuationSheet } from "@/components/valuation-sheet";
import { getFormatDate } from "@/common/format-util";
import {
  AccountChartsCard,
  type ChartKey,
} from "@/screens/home-screen/components/account-charts-card";
import { RecentTransactionsCard } from "@/screens/home-screen/components/recent-transactions-card";
import { SpendingCard } from "@/screens/home-screen/components/spending-card";
import { BudgetCard } from "@/screens/home-screen/components/budget-card";
import { FeedCard } from "@/screens/home-screen/components/feed-card";
import { AskAiCard } from "@/screens/home-screen/components/ask-ai-card";
import { config } from "@/config";
import { getPrimaryCurrency } from "@/common/currency-util";
import { ColorTheme } from "@/types/theme-props";
import { useRouter } from "expo-router";
import { AddTransactionCallback } from "@/common/globalFnFactory";
import { useSession } from "@/common/hooks/use-session";
import { useThemeStyle } from "@/common/hooks";
import { useTheme } from "@/common/theme";
import {
  DashboardScrollView,
  LedgerDrawerHeader,
  StaleDataBanner,
} from "@/components";
import { LedgerGuard, useLedgerGuard } from "@/components/ledger-guard";
import { isShowingStaleDataFromQueries } from "@/common/apollo/stale-data";

const getStyles = (theme: ColorTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.white,
    },
  });

const HomeScreenImpl = (): JSX.Element => {
  const { userId } = useSession();
  const { t, locale } = useTranslations();
  const theme = useTheme().colorTheme;
  const styles = useThemeStyle(getStyles);
  const router = useRouter();
  const ledgerId = useLedgerGuard();
  const { canWrite } = useLedgerAccess();
  const {
    currencies,
    refetch: ledgerMetaRefetch,
    data: ledgerMeta,
    error: ledgerMetaError,
  } = useLedgerMeta(userId, ledgerId);

  const currency = getPrimaryCurrency(currencies);
  const { currency: displayCurrency } = useDisplayCurrency(
    ledgerId,
    currencies,
  );
  // One balance-sheet query feeds all three curves on the card. Home is the
  // only place net worth is charted; the Accounts tab is account lists only.
  const {
    data: balanceSheet,
    loading: balanceSheetLoading,
    refetch: balanceSheetRefetch,
    error: balanceSheetError,
  } = useBalanceSheet(ledgerId);
  // Net worth alone is re-read in the selected display currency — assets and
  // liabilities stay native, since those cards' own accounts (mostly) live in
  // one currency each; net worth is the one figure that sums across all of
  // them and needs a single currency to be a meaningful total.
  const {
    data: convertedBalanceSheet,
    loading: convertedLoading,
    refetch: convertedRefetch,
    error: convertedError,
  } = useBalanceSheet(ledgerId, undefined, displayCurrency);
  const netWorthSeries = useMemo(
    () => selectNetWorthSeries(displayCurrency, convertedBalanceSheet),
    [displayCurrency, convertedBalanceSheet],
  );
  // The same net worth, broken down by native currency (EUR / GBP / …) — shown
  // as a footnote line under the chart when there's more than one to show.
  const netWorthHoldings = useMemo(
    () => selectNetWorthHoldings(balanceSheet),
    [balanceSheet],
  );
  const assetsSeries = useMemo(
    () => selectAssetsSeries(currency, balanceSheet),
    [currency, balanceSheet],
  );
  const liabilitiesSeries = useMemo(
    () => selectLiabilitiesSeries(currency, balanceSheet),
    [currency, balanceSheet],
  );
  // Every figure on the card is at market. The same curves at cost and in
  // units, and the ledger's price dates, are what let each caption say so:
  // which basis, how old its prices, which holdings stayed at cost or out.
  const {
    data: balanceSheetBasis,
    loading: basisLoading,
    refetch: basisRefetch,
    error: basisError,
  } = useBalanceSheetBasis(ledgerId);
  const {
    prices,
    managed,
    data: pricesData,
    loading: pricesLoading,
    refetch: pricesRefetch,
    error: pricesError,
  } = useLedgerPrices(ledgerId);
  const today = useMemo(() => getFormatDate(new Date()), []);
  const { valuations, chartCaptions, chartFootnotes } = useMemo(() => {
    const valuationOf = (series: SheetSeries) =>
      selectSeriesValuation(
        currency,
        series,
        balanceSheet,
        balanceSheetBasis,
        prices,
        today,
        managed,
      );
    const pages: Record<ChartKey, Valuation> = {
      netWorth: valuationOf("netWorthData"),
      assets: valuationOf("assetsData"),
      liabilities: valuationOf("liabilitiesData"),
    };
    // One status line per page; none for a page whose total values no
    // holding, since a cash balance has no basis to state.
    const caption = (key: ChartKey) =>
      valuationStatus(pages[key], t, locale) ?? undefined;
    return {
      valuations: pages,
      chartCaptions: {
        netWorth: caption("netWorth"),
        assets: caption("assets"),
        liabilities: caption("liabilities"),
      },
      chartFootnotes: {
        netWorth:
          [
            costBasisLine(pages.netWorth, currency, t),
            netWorthHoldings.length > 1
              ? netWorthHoldings
                  .map((holding) => formatHolding(holding))
                  .join(" · ")
              : null,
          ]
            .filter((line): line is string => Boolean(line))
            .join(" — ") || undefined,
      },
    };
  }, [
    t,
    locale,
    currency,
    balanceSheet,
    balanceSheetBasis,
    prices,
    managed,
    today,
    netWorthHoldings,
  ]);
  // The page whose holdings the detail sheet shows; null while it is closed.
  const [detailPage, setDetailPage] = useState<ChartKey | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);
  // Skeleton only on first load. Folding `refreshing` in here meant every
  // pull-to-refresh tore a perfectly good chart down to a pulsing tile — the
  // inverse of the rule the rest of the app follows, where current content
  // stays visible under the RefreshControl spinner.
  //
  // The basis and price reads hold the skeleton too, so a caption never lands
  // after its figure and pushes it down. A failed one releases it: the figure
  // then says only what it can still tell.
  const isLoading =
    (balanceSheetLoading && !balanceSheet) ||
    (convertedLoading && !convertedBalanceSheet && !convertedError) ||
    (basisLoading && !balanceSheetBasis && !basisError) ||
    (pricesLoading && !pricesData && !pricesError);
  // First-load failure (error, no cache) keeps the chart skeleton; cached
  // data with a failed refetch shows the numbers + stale banner instead.
  const chartError =
    (Boolean(balanceSheetError) && !balanceSheet) ||
    (Boolean(convertedError) && !convertedBalanceSheet);
  const showStale = isShowingStaleDataFromQueries([
    { data: balanceSheet, error: balanceSheetError },
    { data: convertedBalanceSheet, error: convertedError },
    { data: balanceSheetBasis, error: basisError },
    { data: pricesData, error: pricesError },
    { data: ledgerMeta, error: ledgerMetaError },
  ]);
  const onRefresh = async () => {
    setRefreshing(true);
    setRefreshSignal((signal) => signal + 1);
    try {
      await Promise.all([
        ledgerMetaRefetch(),
        balanceSheetRefetch(),
        convertedRefetch(),
        basisRefetch(),
        pricesRefetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <LedgerDrawerHeader
        title={t("home")}
        action={
          canWrite && {
            testID: "home-add-menu-button",
            accessibilityLabel: t("quickAdd"),
            icon: <Ionicons name="add" size={26} color={theme.black} />,
            items: [
              {
                label: t("enterNewTransaction"),
                icon: (
                  <MaterialCommunityIcons
                    name="gesture-tap"
                    size={22}
                    color={theme.black80}
                  />
                ),
                onPress: () => {
                  AddTransactionCallback.setFn(onRefresh);
                  router.navigate({ pathname: "/add-transaction" });
                },
              },
              {
                label: t("scanReceipt"),
                icon: (
                  <Ionicons
                    name="scan-outline"
                    size={22}
                    color={theme.black80}
                  />
                ),
                onPress: () => {
                  AddTransactionCallback.setFn(onRefresh);
                  router.navigate({ pathname: "/receipt-capture" });
                },
              },
            ],
          }
        }
      />
      {showStale ? <StaleDataBanner /> : null}
      <DashboardScrollView refreshing={refreshing} onRefresh={onRefresh}>
        {config.features.agentChat && <AskAiCard />}
        <AccountChartsCard
          currency={currency}
          netWorthSeries={netWorthSeries}
          assetsSeries={assetsSeries}
          liabilitiesSeries={liabilitiesSeries}
          captions={chartCaptions}
          footnotes={chartFootnotes}
          onCaptionPress={setDetailPage}
          loading={isLoading}
          error={chartError}
        />
        <ValuationSheet
          valuation={detailPage === null ? null : valuations[detailPage]}
          ledgerId={ledgerId}
          onClose={() => setDetailPage(null)}
        />

        <RecentTransactionsCard
          ledgerId={ledgerId}
          refreshSignal={refreshSignal}
        />

        <SpendingCard
          ledgerId={ledgerId}
          currency={currency}
          refreshSignal={refreshSignal}
        />

        <BudgetCard ledgerId={ledgerId} refreshSignal={refreshSignal} />

        <FeedCard refreshSignal={refreshSignal} />
      </DashboardScrollView>
    </View>
  );
};

export const HomeScreen = () => {
  return (
    <LedgerGuard>
      <HomeScreenImpl />
    </LedgerGuard>
  );
};
