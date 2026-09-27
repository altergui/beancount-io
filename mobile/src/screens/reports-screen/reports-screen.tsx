import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ColorTheme } from "@/types/theme-props";
import { useThemeStyle } from "@/common/hooks";
import { useTranslations } from "@/common/hooks/use-translations";
import { useSession } from "@/common/hooks/use-session";
import { useDisplayCurrency } from "@/common/hooks/use-display-currency";
import { fontSizes, gutter } from "@/common/theme";
import { CurrencySelector } from "@/components/currency-selector";
import { formatSignedMoneyWithCurrency } from "@/common/number-utils";
import { LedgerDrawerHeader } from "@/components/ledger-drawer/ledger-drawer-header";
import { StaleDataBanner } from "@/components/stale-data-banner";
import { LedgerGuard, useLedgerGuard } from "@/components/ledger-guard";
import { DashboardCard } from "@/components/dashboard-card";
import { DashboardScrollView } from "@/components/dashboard-scroll-view";
import { LoadingTile } from "@/components/loading-tile";
import { FadeInView } from "@/components/crossfade";
import {
  DEFAULT_CHART_HEIGHT,
  IncomeExpenseBarChartD3,
  LEGEND_HEIGHT,
} from "@/common/d3/income-expense-bar-chart";
import { TimeRangePills } from "@/components/time-range-pills";
import { RANGE_LABEL_KEYS, TIME_RANGES, TimeRange } from "@/common/series-util";
import { useLedgerMeta } from "@/common/hooks/use-ledger-meta";
import { isShowingStaleDataFromQueries } from "@/common/apollo/stale-data";
import { useIncomeStatement } from "./hooks/use-income-statement";
import { selectRangedAccountTree } from "./selectors/select-ranged-account-tree";
import {
  selectIncomeExpenseChartSeries,
  selectStatementAnchorMonth,
  selectUnconvertedTotals,
} from "./selectors/select-income-expense-chart";
import { topNWithOther } from "./selectors/select-breakdown-rows";
import {
  CategoryBreakdown,
  CategoryBreakdownSkeleton,
} from "./components/category-breakdown";
import {
  CashFlowSankey,
  CashFlowSankeySkeleton,
} from "./components/cash-flow-sankey";
import { AccountTransactionsCard } from "./components/account-transactions-card";
import { reportScrollStyles } from "./components/report-scroll-style";

/** How many top categories to show before folding the tail into "Other". */
const BREAKDOWN_TOP_N = 7;

const getStyles = (theme: ColorTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.white,
    },
    notConverted: {
      fontSize: fontSizes.xs,
      color: theme.black60,
      paddingHorizontal: gutter,
      paddingBottom: 8,
    },
  });

const ReportsScreenImpl = (): JSX.Element => {
  const { userId } = useSession();
  const ledgerId = useLedgerGuard();
  const { t } = useTranslations();
  const styles = useThemeStyle(getStyles);

  const [timeRange, setTimeRange] = useState<TimeRange>("6M");
  const [refreshing, setRefreshing] = useState(false);

  const {
    currencies,
    data: ledgerMeta,
    error: ledgerMetaError,
  } = useLedgerMeta(userId, ledgerId);
  const {
    currency,
    options: currencyOptions,
    setCurrency,
  } = useDisplayCurrency(ledgerId, currencies);

  const {
    data: incomeData,
    loading: incomeLoading,
    refetch: incomeRefetch,
    error: incomeError,
  } = useIncomeStatement(ledgerId, currency);
  const stmt = incomeData?.getLedgerIncomeStatement;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await incomeRefetch();
    } finally {
      setRefreshing(false);
    }
  }, [incomeRefetch]);

  const rangeOptions = TIME_RANGES.map((key) => ({
    key,
    label: t(RANGE_LABEL_KEYS[key]),
  }));

  // Combined chart: income and net profit are credit-normal in the API, so
  // negate both at the presentation boundary; expenses stay as debits.
  const chart = useMemo(
    () =>
      selectIncomeExpenseChartSeries(
        currency,
        stmt?.incomeData,
        stmt?.expensesData,
        stmt?.netProfitData,
        timeRange,
      ),
    [currency, stmt, timeRange],
  );

  // One anchor month for the whole report, derived from the same statement the
  // chart is built from — so the recent-transactions list below cannot window on
  // a different month than the chart above.
  const anchorMonth = useMemo(
    () =>
      selectStatementAnchorMonth(
        stmt?.incomeData,
        stmt?.expensesData,
        stmt?.netProfitData,
      ),
    [stmt],
  );

  const expense = useMemo(
    () =>
      selectRangedAccountTree(
        currency,
        stmt?.expensesData ?? [],
        timeRange,
        "expenses",
      ),
    [currency, stmt, timeRange],
  );
  const income = useMemo(
    () =>
      selectRangedAccountTree(
        currency,
        stmt?.incomeData ?? [],
        timeRange,
        "income",
      ),
    [currency, stmt, timeRange],
  );

  // Currencies the server couldn't fold into `currency` for lack of a direct or
  // inverse price (an JPY balance in a EUR/GBP ledger, say), summed over the
  // visible range — disclosed under the chart instead of silently vanishing.
  const unconverted = useMemo(
    () =>
      selectUnconvertedTotals(
        currency,
        timeRange,
        stmt?.incomeData,
        stmt?.expensesData,
        stmt?.netProfitData,
      ),
    [currency, timeRange, stmt],
  );

  const isLoading = incomeLoading && !incomeData;
  const showStale = isShowingStaleDataFromQueries([
    { data: incomeData, error: incomeError },
    { data: ledgerMeta, error: ledgerMetaError },
  ]);

  return (
    <View style={styles.container}>
      <LedgerDrawerHeader title={t("reports")} />
      {showStale ? <StaleDataBanner /> : null}
      <TimeRangePills
        value={timeRange}
        options={rangeOptions}
        onChange={setTimeRange}
      />
      <CurrencySelector
        currency={currency}
        options={currencyOptions}
        onChange={setCurrency}
      />
      <DashboardScrollView
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={reportScrollStyles.content}
      >
        <DashboardCard bleed>
          {isLoading ? (
            <LoadingTile
              height={DEFAULT_CHART_HEIGHT + LEGEND_HEIGHT}
              mx={gutter}
            />
          ) : (
            <FadeInView>
              <IncomeExpenseBarChartD3
                currency={currency}
                months={chart.months}
                income={chart.income}
                expense={chart.expense}
                net={chart.net}
              />
              {unconverted.length > 0 ? (
                <Text style={styles.notConverted}>
                  {t("notConverted", {
                    amounts: unconverted
                      .map((amount) =>
                        formatSignedMoneyWithCurrency(
                          amount.number,
                          amount.currency,
                        ),
                      )
                      .join(", "),
                  })}
                </Text>
              ) : null}
            </FadeInView>
          )}
        </DashboardCard>

        <DashboardCard bleed title={t("cashFlow")}>
          {isLoading ? (
            <CashFlowSankeySkeleton />
          ) : (
            <FadeInView>
              <CashFlowSankey
                income={income.tree}
                expenses={expense.tree}
                currency={currency}
              />
            </FadeInView>
          )}
        </DashboardCard>

        {isLoading ? (
          <CategoryBreakdownSkeleton />
        ) : (
          <FadeInView>
            <DashboardCard bleed>
              <CategoryBreakdown
                label={t("expenses")}
                total={expense.total}
                items={topNWithOther(expense.tree, BREAKDOWN_TOP_N, t("other"))}
                currency={currency}
                tone={(theme) => theme.error}
              />
            </DashboardCard>
          </FadeInView>
        )}

        {isLoading ? (
          <CategoryBreakdownSkeleton />
        ) : (
          <FadeInView>
            <DashboardCard bleed>
              <CategoryBreakdown
                label={t("income")}
                total={income.total}
                items={topNWithOther(income.tree, BREAKDOWN_TOP_N, t("other"))}
                currency={currency}
                tone={(theme) => theme.success}
              />
            </DashboardCard>
          </FadeInView>
        )}

        <AccountTransactionsCard
          ledgerId={ledgerId}
          accountPrefix={["Income", "Expenses"]}
          titleKey="recentTransactions"
          emptyKey="recentTransactionsEmpty"
          timeRange={timeRange}
          anchorMonth={anchorMonth}
          refreshing={refreshing}
        />
      </DashboardScrollView>
    </View>
  );
};

export const ReportsScreen = (): JSX.Element => {
  return (
    <LedgerGuard>
      <ReportsScreenImpl />
    </LedgerGuard>
  );
};
