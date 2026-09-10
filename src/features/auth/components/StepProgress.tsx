import { Text, View } from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { auth, color, radius, space, typeScale, weight } from '@/theme/tokens';

interface StepProgressProps {
  step: 1 | 2;
  totalSteps?: number;
}

/** "Step N of 2" label with a thin progress bar (invited setup flow). */
export function StepProgress({ step, totalSteps = 2 }: StepProgressProps) {
  const ds = useScaledStyles();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: ds.spacing(space[3] - 2),
        marginBottom: ds.spacing(space[6]),
      }}
    >
      <Text
        style={{
          fontSize: ds.fontSize(typeScale.secondary),
          fontWeight: weight.semibold,
          color: auth.dim,
        }}
      >
        Step {step} of {totalSteps}
      </Text>
      <View
        style={{
          flex: 1,
          height: ds.spacing(space[1]),
          borderRadius: radius.pill,
          backgroundColor: auth.well,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.round((step / totalSteps) * 100)}%`,
            height: '100%',
            borderRadius: radius.pill,
            backgroundColor: color.accent,
          }}
        />
      </View>
    </View>
  );
}
