import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors } from '@/constants';
import { useStockStore } from '@/store';
import { radius, typeScale, weight } from '@/theme/tokens';
import { Loading } from '@/components/ui/Loading';
import { Sheet } from '@/components/ui/Sheet';

interface QrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (areaId: string) => void;
}

function parseQrPayload(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.type === 'babytuna_area' && typeof parsed.id === 'string') {
      return parsed.id;
    }
  } catch {
    // ignore
  }

  return raw;
}

export function QrScannerModal({ visible, onClose, onScan }: QrScannerModalProps) {
  const storageAreas = useStockStore((state) => state.storageAreas);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPermission = permission?.granted ?? false;
  const canAskAgain = permission?.canAskAgain ?? false;

  useEffect(() => {
    if (visible) {
      setError(null);
      setScanned(false);
      if (!hasPermission) {
        requestPermission();
      }
    }
  }, [visible, hasPermission, requestPermission]);

  const handleOpenSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scanned) return;
      setScanned(true);

      const parsed = parseQrPayload(data);
      const normalized = parsed.toLowerCase();
      const match =
        storageAreas.find((area) => area.qr_code?.toLowerCase() === normalized) ||
        storageAreas.find((area) => area.id === parsed);

      if (!match) {
        setError('This QR code is not registered.');
        setTimeout(() => setScanned(false), 1500);
        return;
      }

      onScan(match.id);
      onClose();
    },
    [scanned, storageAreas, onScan, onClose]
  );

  const statusContent = useMemo(() => {
    if (permission === null) {
      return (
        <View style={styles.permissionContainer}>
          <Loading size="inline" color={colors.primary[600]} />
          <Text style={styles.permissionText}>Requesting camera access...</Text>
        </View>
      );
    }

    if (!hasPermission) {
      return (
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={32} color={colors.warning} />
          <Text style={styles.permissionText}>
            Camera access is required to scan QR codes.
          </Text>
          {canAskAgain ? (
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Allow Camera</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.permissionButton} onPress={handleOpenSettings}>
              <Text style={styles.permissionButtonText}>Open Settings</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return null;
  }, [permission, hasPermission, canAskAgain, requestPermission, handleOpenSettings]);

  return (
    <Sheet visible={visible} title="Scan QR Code" onClose={onClose}>
      <View style={styles.cameraContainer}>
        {statusContent ? (
          statusContent
        ) : (
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
        )}
        <View style={styles.frame} />
      </View>

      <Text style={styles.instruction}>Scan the QR code at any station.</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  cameraContainer: {
    height: 320,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 220,
    height: 220,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.overlay,
  },
  instruction: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    fontSize: typeScale.body,
    textAlign: 'center',
    color: colors.gray[700],
  },
  errorText: {
    paddingBottom: 16,
    paddingHorizontal: 20,
    fontSize: typeScale.secondary,
    textAlign: 'center',
    color: colors.error,
  },
  permissionContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  permissionText: {
    marginTop: 12,
    textAlign: 'center',
    color: colors.gray[700],
  },
  permissionButton: {
    marginTop: 12,
    backgroundColor: colors.primary[500],
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
  },
  permissionButtonText: {
    color: colors.white,
    fontWeight: weight.semibold,
  },
});
