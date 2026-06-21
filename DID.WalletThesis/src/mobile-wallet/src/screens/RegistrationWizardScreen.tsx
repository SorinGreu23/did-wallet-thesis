import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { ethers } from "ethers";
import { useTheme } from "../context/ThemeContext";
import { useRegistration } from "../context/RegistrationContext";
import { AccountType } from "../types/wallet";
import euGeoService from "../services/euGeoService";
import pinService from "../services/pinService";
import authService from "../services/authService";
import didService from "../services/didService";
import { getAgent } from "../agents/veramoAgent";
import accreditationLookupService from "../services/accreditationLookupService";
import { CONFIG } from "../constants/config";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ENTERPRISE_REQUEST_KEY = "enterprise_request_id";

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(iso: string): string {
  if (!iso) return "Select date of birth";
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── Step types ───────────────────────────────────────────────────────────────

type Step =
  | "identity"
  | "address"
  | "gating"
  | "pin"
  | "pin-confirm"
  | "consents";

type CreatedIdentity = {
  did: string;
  walletAddress: string;
};

interface Props {
  accountType: AccountType;
  onComplete: () => void;
  onBack: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Label({ text, colors }: { text: string; colors: any }) {
  return (
    <Text style={[styles.label, { color: colors.textSecondary }]}>{text}</Text>
  );
}

function Field({
  placeholder,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
  inputRef,
  onSubmitEditing,
  returnKeyType,
  colors,
}: {
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: any;
  autoCapitalize?: any;
  secureTextEntry?: boolean;
  inputRef?: React.RefObject<TextInput>;
  onSubmitEditing?: () => void;
  returnKeyType?: any;
  colors: any;
}) {
  return (
    <TextInput
      ref={inputRef}
      style={[
        styles.input,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          color: colors.text,
        },
      ]}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize ?? "words"}
      secureTextEntry={secureTextEntry}
      onSubmitEditing={onSubmitEditing}
      returnKeyType={returnKeyType ?? "next"}
      autoCorrect={false}
    />
  );
}

function Picker({
  label,
  value,
  options,
  onSelect,
  colors,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
  colors: any;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.pickerWrap, open && { zIndex: 100 }]}>
      <TouchableOpacity
        style={[
          styles.pickerBtn,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        onPress={() => setOpen((o) => !o)}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.pickerValue,
            { color: value ? colors.text : colors.textMuted },
          ]}
        >
          {value || label}
        </Text>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.textMuted}
        />
      </TouchableOpacity>
      {open && (
        <View
          style={[
            styles.dropdown,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.dropdownItem,
                  { borderBottomColor: colors.border },
                ]}
                onPress={() => {
                  onSelect(opt);
                  setOpen(false);
                }}
              >
                <Text style={[styles.dropdownText, { color: colors.text }]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function PinKeypad({
  value,
  onChange,
  colors,
}: {
  value: string;
  onChange: (v: string) => void;
  colors: any;
}) {
  const rows = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["", "0", "⌫"],
  ];
  return (
    <View style={styles.keypad}>
      <View style={styles.pinDots}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={[
              styles.pinDot,
              {
                backgroundColor:
                  i < value.length ? colors.primary : colors.border,
                borderColor: colors.border,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.keypadGrid}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.keypadRow}>
            {row.map((d, ci) => (
              <TouchableOpacity
                key={ci}
                style={[
                  styles.keypadKey,
                  d === "" && { opacity: 0 },
                  {
                    backgroundColor: d ? colors.surface : "transparent",
                    borderColor: colors.border,
                  },
                ]}
                disabled={d === ""}
                onPress={() => {
                  if (d === "⌫") {
                    onChange(value.slice(0, -1));
                  } else if (value.length < 6) {
                    onChange(value + d);
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.keypadText, { color: colors.text }]}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RegistrationWizardScreen({
  accountType,
  onComplete,
  onBack,
}: Props) {
  const { colors } = useTheme();
  const {
    state,
    update,
    setIdentity,
    setAccreditationId,
    did,
    walletAddress,
    accreditationId,
  } = useRegistration();

  const [step, setStep] = useState<Step>("identity");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinConfirm, setPinConfirm] = useState("");
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [pendingBirthDate, setPendingBirthDate] = useState(
    new Date(1990, 0, 1),
  );

  // Gating state for enterprise
  const [enterpriseRequestId, setEnterpriseRequestId] = useState<string | null>(
    null,
  );
  const [pollingAccreditation, setPollingAccreditation] = useState(false);

  // Restore persisted enterprise request ID on mount and auto-check if already approved
  useEffect(() => {
    if (accountType !== "enterprise") return;
    AsyncStorage.getItem(ENTERPRISE_REQUEST_KEY).then(async (saved) => {
      if (!saved) return;
      setEnterpriseRequestId(saved);
      // Silently check if already approved so the user doesn't have to tap
      try {
        const res = await fetch(
          `${CONFIG.ACCREDITATION_SERVICE_URL}/api/enterprise-registrations/${saved}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "Approved" && data.accreditationId) {
          setAccreditationId(data.accreditationId);
          await AsyncStorage.removeItem(ENTERPRISE_REQUEST_KEY);
          go("pin");
        }
      } catch {
        // silent — user can still tap "Check approval status"
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gating state for university
  const [universityPrivateKey, setUniversityPrivateKey] = useState("");
  const [derivedAddress, setDerivedAddress] = useState<string | null>(null);

  const slideAnim = useRef(new Animated.Value(0)).current;

  // Refs for identity form focus management
  const lastNameRef = useRef<TextInput | null>(null);
  const emailRef = useRef<TextInput | null>(null);
  const legalRef = useRef<TextInput | null>(null);
  const fiscalRef = useRef<TextInput | null>(null);

  const animateNext = () => {
    slideAnim.setValue(30);
    Animated.spring(slideAnim, {
      toValue: 0,
      damping: 18,
      stiffness: 140,
      useNativeDriver: true,
    }).start();
  };

  const go = (nextStep: Step) => {
    setError(null);
    setStep(nextStep);
    animateNext();
  };

  // ── Step: identity ─────────────────────────────────────────────────────────

  const renderIdentity = () => {
    const hasValidEmail =
      state.email.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim());

    const canAdvance =
      accountType === "personal"
        ? state.firstName.trim() &&
          state.lastName.trim() &&
          state.birthDate &&
          hasValidEmail
        : state.legalName.trim() &&
          hasValidEmail &&
          (accountType === "enterprise" ? state.fiscalCode.trim() : true);

    return (
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          {accountType === "personal"
            ? "Your identity"
            : "Organisation details"}
        </Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          {accountType === "personal"
            ? "Enter your legal name as it appears on your ID."
            : "Enter the legal name registered with the authority."}
        </Text>

        {accountType === "personal" ? (
          <>
            <Label text="First name" colors={colors} />
            <Field
              placeholder="First name"
              value={state.firstName}
              onChangeText={(v) => update({ firstName: v })}
              onSubmitEditing={() => lastNameRef.current?.focus()}
              colors={colors}
            />
            <Label text="Last name" colors={colors} />
            <Field
              inputRef={lastNameRef as React.RefObject<TextInput>}
              placeholder="Last name"
              value={state.lastName}
              onChangeText={(v) => update({ lastName: v })}
              onSubmitEditing={() => emailRef.current?.focus()}
              colors={colors}
            />
            <Label text="Date of birth" colors={colors} />
            <TouchableOpacity
              style={[
                styles.input,
                styles.dateField,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => setShowBirthDatePicker(true)}
              activeOpacity={0.75}
            >
              <Text
                style={{
                  color: state.birthDate ? colors.text : colors.textMuted,
                }}
              >
                {formatDate(state.birthDate)}
              </Text>
              <Feather name="calendar" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Label text="Legal name" colors={colors} />
            <Field
              inputRef={legalRef as React.RefObject<TextInput>}
              placeholder="e.g. Universität Wien"
              value={state.legalName}
              onChangeText={(v) => update({ legalName: v })}
              onSubmitEditing={() => fiscalRef.current?.focus()}
              colors={colors}
            />
            {accountType === "enterprise" && (
              <>
                <Label text="Fiscal / VAT code" colors={colors} />
                <Field
                  inputRef={fiscalRef as React.RefObject<TextInput>}
                  placeholder="e.g. RO1234567"
                  value={state.fiscalCode}
                  onChangeText={(v) => update({ fiscalCode: v })}
                  autoCapitalize="characters"
                  onSubmitEditing={() => emailRef.current?.focus()}
                  colors={colors}
                />
              </>
            )}
          </>
        )}

        <Label text="Email" colors={colors} />
        <Field
          inputRef={emailRef as React.RefObject<TextInput>}
          placeholder="contact@example.com"
          value={state.email}
          onChangeText={(v) => update({ email: v })}
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="done"
          colors={colors}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[
            styles.btn,
            { backgroundColor: canAdvance ? colors.primary : colors.border },
          ]}
          disabled={!canAdvance}
          onPress={() => {
            if (
              state.email.trim() &&
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email.trim())
            ) {
              setError("Please enter a valid email address.");
              return;
            }
            go("address");
          }}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.btnText,
              { color: canAdvance ? "#fff" : colors.textMuted },
            ]}
          >
            Continue
          </Text>
          <Feather
            name="arrow-right"
            size={16}
            color={canAdvance ? "#fff" : colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    );
  };

  // ── Step: address ──────────────────────────────────────────────────────────

  const renderAddress = () => {
    const countries = euGeoService.getCountries();
    const regions = state.country
      ? euGeoService.getRegionsForCountry(
          countries.find((c) => c.name === state.country)?.code ?? "",
        )
      : [];

    const canAdvance = state.country && state.county && state.city.trim();

    return (
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>Location</Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          Your country of residence or operation.
        </Text>

        <Label text="Country" colors={colors} />
        <Picker
          label="Select country"
          value={state.country}
          options={countries.map((c) => c.name)}
          onSelect={(v) => update({ country: v, county: "", city: "" })}
          colors={colors}
        />

        <Label text="Region / County" colors={colors} />
        <Picker
          label="Select region"
          value={state.county}
          options={regions}
          onSelect={(v) => update({ county: v })}
          colors={colors}
        />

        <Label text="City" colors={colors} />
        <Field
          placeholder="City"
          value={state.city}
          onChangeText={(v) => update({ city: v })}
          colors={colors}
        />

        <Label text="Street address (optional)" colors={colors} />
        <Field
          placeholder="Street and number"
          value={state.address}
          onChangeText={(v) => update({ address: v })}
          colors={colors}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[
            styles.btn,
            { backgroundColor: canAdvance ? colors.primary : colors.border },
          ]}
          disabled={!canAdvance}
          onPress={() => {
            if (accountType === "personal") {
              go("pin");
            } else {
              go("gating");
            }
          }}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.btnText,
              { color: canAdvance ? "#fff" : colors.textMuted },
            ]}
          >
            Continue
          </Text>
          <Feather
            name="arrow-right"
            size={16}
            color={canAdvance ? "#fff" : colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    );
  };

  // ── Step: gating ───────────────────────────────────────────────────────────

  const ensureIdentityCreated = async (): Promise<CreatedIdentity> => {
    if (did && walletAddress) {
      return { did, walletAddress };
    }

    await authService.createWallet();

    const identity = await didService.getOrCreateIdentity();
    const nextDid = identity.did;
    const nextWalletAddress = identity.ethereumAddress;

    setIdentity(nextDid, nextWalletAddress);

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const message = `${nextWalletAddress.toLowerCase()}:${timestamp}`;
      const kid = identity.keys[0]?.kid;
      let signature: string | undefined;
      if (kid) {
        signature = await getAgent().keyManagerSign({
          keyRef: kid,
          data: message,
          algorithm: "eth_signMessage",
          encoding: "utf-8",
        });
      }

      await fetch(`${CONFIG.IDENTITY_SERVICE_URL}/api/identities/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          did: nextDid,
          controllerAddress: nextWalletAddress,
          displayName:
            accountType === "personal"
              ? `${state.firstName} ${state.lastName}`
              : state.legalName,
          email: state.email.trim(),
          accountType,
          timestamp,
          signature,
        }),
      });
    } catch {
      // Best-effort only. The wallet can still work locally if identity-service is offline
    }

    return { did: nextDid, walletAddress: nextWalletAddress };
  };

  React.useEffect(() => {
    if (step !== "gating") return;
    if (accountType === "personal" || accountType === "university") return;
    if (did && walletAddress) return;

    setLoading(true);
    setError(null);

    ensureIdentityCreated()
      .catch((e: any) => {
        setError(e.message ?? "Failed to create wallet identity.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [step, accountType, did, walletAddress]);

  const onUniversityKeyChange = (key: string) => {
    setUniversityPrivateKey(key);
    setError(null);
    const trimmed = key.trim();
    const isFullKey =
      trimmed.length === 64 ||
      (trimmed.startsWith("0x") && trimmed.length === 66);
    if (!isFullKey) {
      setDerivedAddress(null);
      return;
    }
    try {
      const normalized = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
      const addr = ethers.computeAddress(normalized);
      setDerivedAddress(addr);
    } catch {
      setDerivedAddress(null);
    }
  };

  const handleCheckUniversityAccreditation = async () => {
    if (!derivedAddress) {
      setError("Enter your institution private key first.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const trimmed = universityPrivateKey.trim();
      const normalized = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
      const wallet = new ethers.Wallet(normalized);
      const address = wallet.address;
      const did = `did:ethr:sepolia:${address.toLowerCase()}`;

      // Persist identity so subsequent steps have the right address
      setIdentity(did, address);

      // Store the private key so the Veramo agent can sign later
      await authService.createWallet();
      await didService.getOrCreateIdentity();

      const id =
        await accreditationLookupService.findActiveInstitutionAccreditation(
          address,
        );

      if (id) {
        setAccreditationId(id);
        go("pin");
      } else {
        setError(
          "No valid accreditation found for this wallet address. Ask your operator to issue one, then try again.",
        );
      }
    } catch (e: any) {
      setError(e.message ?? "Failed to look up accreditation.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitEnterpriseRequest = async () => {
    setLoading(true);
    setError(null);
    try {
      const identity = await ensureIdentityCreated();

      const res = await fetch(
        `${CONFIG.ACCREDITATION_SERVICE_URL}/api/enterprise-registrations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            legalName: state.legalName.trim(),
            fiscalCode: state.fiscalCode.trim(),
            country: state.country,
            county: state.county,
            city: state.city,
            address: state.address,
            walletAddress: identity.walletAddress,
          }),
        },
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Registration request failed.");
      }

      const data = await res.json();
      setEnterpriseRequestId(data.requestId);
      await AsyncStorage.setItem(ENTERPRISE_REQUEST_KEY, data.requestId);
    } catch (e: any) {
      setError(e.message ?? "Failed to submit registration.");
    } finally {
      setLoading(false);
    }
  };

  const handlePollEnterpriseApproval = async () => {
    if (!enterpriseRequestId) return;

    setPollingAccreditation(true);
    setError(null);

    try {
      const identity = await ensureIdentityCreated();

      const res = await fetch(
        `${CONFIG.ACCREDITATION_SERVICE_URL}/api/enterprise-registrations/${enterpriseRequestId}`,
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Registration request failed.");
      }

      const data = await res.json();

      if (data.status === "Approved") {
        const id =
          data.accreditationId ||
          (await accreditationLookupService.findActiveEnterpriseAccreditation(
            identity.walletAddress,
          ));

        if (id) {
          setAccreditationId(id);
          await AsyncStorage.removeItem(ENTERPRISE_REQUEST_KEY);
          go("pin");
        } else {
          setError(
            "Approval found but accreditation not yet on-chain. Please try again in a moment.",
          );
        }
      } else if (data.status === "Rejected") {
        setError(
          `Registration rejected: ${data.rejectionReason ?? "no reason provided"}.`,
        );
      } else {
        setError("Approval is still pending. Try again in a few moments.");
      }
    } catch (e: any) {
      setError(e.message ?? "Failed to poll status.");
    } finally {
      setPollingAccreditation(false);
    }
  };

  const renderGating = () => {
    if (accountType === "university") {
      return (
        <View style={styles.stepContent}>
          <Text style={[styles.stepTitle, { color: colors.text }]}>
            Accreditation check
          </Text>
          <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
            Enter the private key of the wallet that was accredited by your
            Ministry of Education.
          </Text>

          <Label text="Institution private key" colors={colors} />
          <Field
            placeholder="0x… or 64 hex chars"
            value={universityPrivateKey}
            onChangeText={onUniversityKeyChange}
            secureTextEntry
            autoCapitalize="none"
            returnKeyType="done"
            colors={colors}
          />

          {derivedAddress ? (
            <View
              style={[
                styles.addressBox,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text
                style={[styles.addressLabel, { color: colors.textSecondary }]}
              >
                Derived wallet address
              </Text>
              <Text
                style={[styles.addressValue, { color: colors.text }]}
                selectable
              >
                {derivedAddress}
              </Text>
            </View>
          ) : null}

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[
              styles.btn,
              {
                backgroundColor: derivedAddress
                  ? colors.primary
                  : colors.border,
              },
            ]}
            onPress={handleCheckUniversityAccreditation}
            disabled={loading || !derivedAddress}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather
                  name="check-circle"
                  size={16}
                  color={derivedAddress ? "#fff" : colors.textMuted}
                />
                <Text
                  style={[
                    styles.btnText,
                    { color: derivedAddress ? "#fff" : colors.textMuted },
                  ]}
                >
                  Verify accreditation
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    // Enterprise
    return (
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Business registration
        </Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          Submit a registration request to the Business Registry for your
          country.
        </Text>

        {walletAddress ? (
          <View
            style={[
              styles.addressBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[styles.addressLabel, { color: colors.textSecondary }]}
            >
              Your wallet address
            </Text>
            <Text
              style={[styles.addressValue, { color: colors.text }]}
              selectable
            >
              {walletAddress}
            </Text>
          </View>
        ) : null}

        {error && <Text style={styles.error}>{error}</Text>}

        {!enterpriseRequestId ? (
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary }]}
            onPress={handleSubmitEnterpriseRequest}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="send" size={16} color="#fff" />
                <Text style={styles.btnText}>Submit registration request</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <>
            <View
              style={[styles.infoBox, { backgroundColor: colors.primaryLight }]}
            >
              <Feather name="clock" size={16} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.primary }]}>
                Request submitted (ID: {enterpriseRequestId}). Tap below once
                approved.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary }]}
              onPress={handlePollEnterpriseApproval}
              disabled={pollingAccreditation}
              activeOpacity={0.85}
            >
              {pollingAccreditation ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="refresh-cw" size={16} color="#fff" />
                  <Text style={styles.btnText}>Check approval status</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  // ── Step: pin ──────────────────────────────────────────────────────────────

  const renderPin = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        Set your PIN
      </Text>
      <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        Choose a 6-digit PIN to protect your wallet.
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <PinKeypad
        value={state.pin}
        onChange={(v) => {
          update({ pin: v });
          if (v.length === 6) {
            setError(null);
            go("pin-confirm");
          }
        }}
        colors={colors}
      />
    </View>
  );

  const renderPinConfirm = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>
        Confirm your PIN
      </Text>
      <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        Enter your 6-digit PIN again to confirm.
      </Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <PinKeypad
        value={pinConfirm}
        onChange={(v) => {
          setPinConfirm(v);
          if (v.length === 6) {
            if (v !== state.pin) {
              setError("PINs do not match. Try again.");
              setPinConfirm("");
              update({ pin: "" });
              go("pin");
            } else {
              setError(null);
              go("consents");
            }
          }
        }}
        colors={colors}
      />
    </View>
  );

  // ── Step: consents ─────────────────────────────────────────────────────────

  const renderConsents = () => {
    const allChecked =
      state.consentTerms && state.consentGdpr && state.consentPrivacy;

    return (
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>
          Terms & Privacy
        </Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          Please review and accept all of the following to continue.
        </Text>

        {(
          [
            {
              key: "consentTerms",
              label:
                "I accept the Terms and Conditions of the EU Identity Wallet.",
            },
            {
              key: "consentGdpr",
              label:
                "I understand how my personal data is processed under GDPR.",
            },
            {
              key: "consentPrivacy",
              label: "I have read and accept the Privacy Policy.",
            },
          ] as { key: keyof typeof state; label: string }[]
        ).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={styles.consentRow}
            onPress={() => update({ [key]: !state[key] } as any)}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: state[key] ? colors.primary : colors.surface,
                  borderColor: state[key] ? colors.primary : colors.border,
                },
              ]}
            >
              {state[key] ? (
                <Feather name="check" size={12} color="#fff" />
              ) : null}
            </View>
            <Text style={[styles.consentText, { color: colors.text }]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[
            styles.btn,
            { backgroundColor: allChecked ? colors.primary : colors.border },
          ]}
          disabled={!allChecked || loading}
          onPress={handleFinish}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather
                name="check-circle"
                size={16}
                color={allChecked ? "#fff" : colors.textMuted}
              />
              <Text
                style={[
                  styles.btnText,
                  { color: allChecked ? "#fff" : colors.textMuted },
                ]}
              >
                Create wallet
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // ── Finish: commit everything ──────────────────────────────────────────────

  const handleFinish = async () => {
    setLoading(true);
    setError(null);
    try {
      if (accountType === "personal" && !state.birthDate) {
        throw new Error("Date of birth is required for personal accounts.");
      }

      // Ensure wallet + DID exist
      const identity = await ensureIdentityCreated();

      // Set up PIN
      await pinService.setupPin(state.pin);

      // Build and persist WalletProfile
      // Important: we use the returned identity, not the React state, because setIdentity()
      // is async and may not be reflected in this render yet.
      const base = {
        did: identity.did,
        walletAddress: identity.walletAddress,
        country: state.country,
        county: state.county,
        city: state.city,
        address: state.address,
        email: state.email.trim(),
      };

      const finalAccreditationId = accreditationId;

      let profile: any;

      if (accountType === "personal") {
        profile = {
          ...base,
          accountType: "personal",
          firstName: state.firstName.trim(),
          lastName: state.lastName.trim(),
          birthDate: state.birthDate,
        };
      } else if (accountType === "university") {
        if (!finalAccreditationId) {
          throw new Error(
            "Missing institution accreditation. Please complete the accreditation step first.",
          );
        }

        profile = {
          ...base,
          accountType: "university",
          legalName: state.legalName.trim(),
          accreditationId: finalAccreditationId,
        };
      } else {
        if (!finalAccreditationId) {
          throw new Error(
            "Missing enterprise accreditation. Please complete the approval step first.",
          );
        }

        profile = {
          ...base,
          accountType: "enterprise",
          legalName: state.legalName.trim(),
          fiscalCode: state.fiscalCode.trim(),
          accreditationId: finalAccreditationId,
        };
      }

      await authService.saveWalletProfile(profile);
      await authService.setSessionActive();
      onComplete();
    } catch (e: any) {
      setError(e.message ?? "Failed to create wallet.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step header / progress ─────────────────────────────────────────────────

  const STEPS: Step[] =
    accountType === "personal"
      ? ["identity", "address", "pin", "pin-confirm", "consents"]
      : ["identity", "address", "gating", "pin", "pin-confirm", "consents"];

  const currentIndex = STEPS.indexOf(step);
  const progress = (currentIndex + 1) / STEPS.length;

  const stepBack = () => {
    if (currentIndex === 0) {
      onBack();
      return;
    }
    go(STEPS[currentIndex - 1]);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar
        barStyle={colors.text === "#111827" ? "dark-content" : "light-content"}
        backgroundColor="transparent"
        translucent
      />

      {/* Header */}
      <View style={styles.wizardHeader}>
        <TouchableOpacity
          onPress={stepBack}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <View
          style={[styles.progressTrack, { backgroundColor: colors.border }]}
        >
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.primary, width: `${progress * 100}%` },
            ]}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
          {step === "identity" && renderIdentity()}
          {step === "address" && renderAddress()}
          {step === "gating" && renderGating()}
          {step === "pin" && renderPin()}
          {step === "pin-confirm" && renderPinConfirm()}
          {step === "consents" && renderConsents()}
        </Animated.View>
      </ScrollView>
      <Modal
        visible={showBirthDatePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBirthDatePicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.datePickerSheet,
              { backgroundColor: colors.surface },
            ]}
          >
            <View
              style={[
                styles.datePickerToolbar,
                { borderBottomColor: colors.border },
              ]}
            >
              <TouchableOpacity onPress={() => setShowBirthDatePicker(false)}>
                <Text style={{ color: colors.textMuted }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.datePickerTitle, { color: colors.text }]}>
                Date of birth
              </Text>
              <TouchableOpacity
                onPress={() => {
                  update({ birthDate: toIsoDate(pendingBirthDate) });
                  setShowBirthDatePicker(false);
                }}
              >
                <Text style={{ color: colors.primary, fontWeight: "700" }}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={pendingBirthDate}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              minimumDate={new Date(1900, 0, 1)}
              onChange={(_event, date) => {
                if (date) setPendingBirthDate(date);
              }}
              style={{ height: 216 }}
              themeVariant={colors.text === "#111827" ? "light" : "dark"}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  wizardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  stepContent: {
    gap: 10,
    paddingTop: 8,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 2,
  },
  stepSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  dateField: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  datePickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  datePickerToolbar: {
    height: 52,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  datePickerTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  pickerWrap: { position: "relative", zIndex: 10, marginBottom: 2 },
  pickerBtn: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerValue: { fontSize: 15 },
  dropdown: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 10,
    zIndex: 100,
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropdownText: { fontSize: 14 },
  btn: {
    height: 50,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  btnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  error: {
    color: "#ef4444",
    fontSize: 13,
    marginTop: 4,
  },
  infoBox: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  addressBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  addressLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  addressValue: {
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  keypad: { alignItems: "center", gap: 24, marginTop: 16 },
  pinDots: { flexDirection: "row", gap: 12 },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  keypadGrid: {
    gap: 16,
  },
  keypadRow: {
    flexDirection: "row",
    gap: 16,
  },
  keypadKey: {
    width: 88,
    height: 72,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  keypadText: { fontSize: 22, fontWeight: "500" },
  consentRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    paddingVertical: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  consentText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
