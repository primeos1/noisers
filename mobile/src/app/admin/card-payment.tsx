import { useState } from "react";
import { StyleSheet, TextInput } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useClub } from "../../lib/club";
import { errorMessage } from "../../lib/api";
import { formatNaira, outstandingFines, participantName } from "../../lib/derive";
import { Hint } from "../../components/form";
import { Button, Screen, Txt, text } from "../../components/ui";
import { colors, fonts, space } from "../../theme";

/** Money a player hands over towards their fines — all of it, or just part. */
export default function CardPaymentScreen() {
  const { playerId: param } = useLocalSearchParams<{ playerId: string }>();
  const playerId = Number(param);
  const { cards, players, recordPayment } = useClub();
  const owed = outstandingFines(cards.filter((c) => c.playerId === playerId));
  const [amountText, setAmountText] = useState(String(owed));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const amount = Number(amountText.replace(/[^0-9.]/g, ""));
  const valid = amountText.trim() !== "" && Number.isFinite(amount) && amount > 0 && amount <= owed;

  async function submit() {
    if (!valid) {
      setError(`Enter an amount between ₦1 and ${formatNaira(owed)}.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await recordPayment(playerId, amount);
      router.back();
    } catch (err) {
      setError(errorMessage(err, "Couldn't record that payment."));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Txt style={[text.semi, styles.name]}>{participantName(players, [], playerId)}</Txt>
      <Txt style={[text.dim, styles.owed]}>Owes {formatNaira(owed)}</Txt>

      <Txt style={styles.label}>Amount paid (₦)</Txt>
      <TextInput
        value={amountText}
        onChangeText={setAmountText}
        style={styles.input}
        keyboardType="number-pad"
        autoFocus
        selectTextOnFocus
        accessibilityLabel="Amount paid in naira"
      />
      <Hint>
        {valid && amount < owed
          ? `${formatNaira(owed - amount)} will still be owed. Their oldest fines are cleared first.`
          : "Their oldest fines are cleared first."}
      </Hint>

      {error ? (
        <Txt style={styles.error} accessibilityRole="alert">
          {error}
        </Txt>
      ) : null}
      <Button label="Save payment" onPress={submit} busy={busy} disabled={owed <= 0} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 20, paddingHorizontal: 4 },
  owed: { marginTop: 4, marginBottom: space.xl, paddingHorizontal: 4 },
  label: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.paperDim, marginBottom: space.sm, paddingHorizontal: 4 },
  input: {
    minHeight: 48,
    backgroundColor: colors.inkRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inkLine,
    paddingHorizontal: space.md,
    color: colors.paper,
    fontFamily: fonts.body,
    fontSize: 16,
    marginBottom: space.md,
  },
  error: { color: colors.loss, fontSize: 14, marginTop: space.md, marginBottom: space.md },
});
