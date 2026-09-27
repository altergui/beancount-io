import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ColorTheme } from "@/types/theme-props";
import { fontSizes, fontWeights, gutter, space } from "@/common/theme";
import { useThemeStyle } from "@/common/hooks/use-theme-style";
import { useTranslations } from "@/common/hooks/use-translations";
import { TimeRangePills } from "@/components/time-range-pills";
import { Picker } from "@/components/picker";

/** Above this many currencies, pills would overflow the row; fall back to a picker. */
const PILLS_MAX = 4;

type CurrencySelectorProps = {
  currency: string;
  options: readonly string[];
  onChange: (currency: string) => void;
};

const getStyles = (theme: ColorTheme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: gutter,
      paddingBottom: space.sm,
    },
    pickerTrigger: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: theme.black10,
    },
    pickerTriggerLabel: {
      fontSize: fontSizes.sm,
      fontWeight: fontWeights.medium,
      color: theme.black80,
    },
  });

/**
 * The currency Reports and Accounts convert their "≈ total" into. Shared
 * between both screens so switching one look feels the same as the other.
 * Nothing to show — a ledger with a single operating currency and no priced
 * pairs — renders nothing at all, matching the pre-multicurrency screens.
 */
export function CurrencySelector({
  currency,
  options,
  onChange,
}: CurrencySelectorProps): JSX.Element | null {
  const styles = useThemeStyle(getStyles);
  const { t } = useTranslations();
  const [pickerVisible, setPickerVisible] = useState(false);

  if (options.length <= 1) {
    return null;
  }

  if (options.length > PILLS_MAX) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.pickerTrigger}
          onPress={() => setPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={t("displayCurrency")}
        >
          <Text style={styles.pickerTriggerLabel}>{currency}</Text>
        </TouchableOpacity>
        <Picker
          visible={pickerVisible}
          items={options.map((option) => ({ label: option, value: option }))}
          selectedValue={currency}
          onSelect={(item) => {
            setPickerVisible(false);
            onChange(item.value);
          }}
          onCancel={() => setPickerVisible(false)}
          title={t("displayCurrency")}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TimeRangePills
        value={currency}
        options={options.map((option) => ({ key: option, label: option }))}
        onChange={(key) => key && onChange(key)}
        haptics={false}
      />
    </View>
  );
}
