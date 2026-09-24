import { useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useAuth } from "../lib/auth";
import { errorMessage } from "../lib/api";
import { colors, fonts, radius, space } from "../theme";
import { Button, Txt } from "./ui";

/** Committee email + password sign-in, used on the welcome screen and the Club tab. */
export function SignInForm({ onSignedIn }: { onSignedIn?: () => void }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const passwordRef = useRef<TextInput>(null);

  async function submit() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await signIn(email, password);
      onSignedIn?.();
    } catch (err) {
      setError(errorMessage(err, "Couldn't sign you in."));
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <Txt style={styles.label}>Email</Txt>
      <TextInput
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        placeholder="you@noisersfc.com"
        placeholderTextColor={colors.mist}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        accessibilityLabel="Email"
      />
      <Txt style={styles.label}>Password</Txt>
      <TextInput
        ref={passwordRef}
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        accessibilityLabel="Password"
      />
      {error ? (
        <Txt style={styles.error} accessibilityRole="alert">
          {error}
        </Txt>
      ) : null}
      <View style={styles.submit}>
        <Button label="Sign in" onPress={submit} busy={busy} />
      </View>
    </View>
  );
}

export const formStyles = StyleSheet.create({
  input: {
    minHeight: 48,
    backgroundColor: colors.ink,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inkLine,
    paddingHorizontal: space.md,
    color: colors.paper,
    fontFamily: fonts.body,
    fontSize: 16,
    marginBottom: space.lg,
  },
  label: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.paperDim, marginBottom: 6 },
  error: { color: colors.loss, fontSize: 14, marginBottom: space.md },
});

const styles = StyleSheet.create({
  ...formStyles,
  form: { backgroundColor: colors.inkRaised, borderRadius: radius.md, padding: space.lg },
  submit: { marginTop: space.xs },
});
