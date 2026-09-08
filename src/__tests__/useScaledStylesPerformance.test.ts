import React from 'react';
import renderer from 'react-test-renderer';
import { PixelRatio } from 'react-native';
import { useScaledStyles } from '@/hooks/useScaledStyles';
import { useDisplayStore } from '@/store/displayStore';

jest.mock('react-native', () => ({
  PixelRatio: { getFontScale: jest.fn(() => 1) },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

describe('useScaledStyles render behavior', () => {
  beforeEach(() => {
    jest.mocked(PixelRatio.getFontScale).mockReturnValue(1);
    useDisplayStore.setState({
      textScale: 1,
      uiScale: 'default',
      buttonSize: 'medium',
      theme: 'system',
      hapticFeedback: true,
      reduceMotion: false,
    });
  });

  test('keeps its return object stable across an unrelated parent render', () => {
    const values: ReturnType<typeof useScaledStyles>[] = [];

    function Probe({ tick }: { tick: number }) {
      const value = useScaledStyles();
      values.push(value);
      return React.createElement('Probe', { tick });
    }

    let component!: renderer.ReactTestRenderer;
    renderer.act(() => {
      component = renderer.create(React.createElement(Probe, { tick: 0 }));
    });
    renderer.act(() => {
      component.update(React.createElement(Probe, { tick: 1 }));
    });

    expect(values).toHaveLength(2);
    expect(values[1]).toBe(values[0]);
    renderer.act(() => component.unmount());
  });

  test('does not rerender when a display setting outside its return contract changes', () => {
    let renderCount = 0;

    function Probe() {
      useScaledStyles();
      renderCount += 1;
      return React.createElement('Probe');
    }

    let component!: renderer.ReactTestRenderer;
    renderer.act(() => {
      component = renderer.create(React.createElement(Probe));
    });
    expect(renderCount).toBe(1);

    renderer.act(() => {
      useDisplayStore.getState().setHapticFeedback(false);
    });

    expect(renderCount).toBe(1);
    renderer.act(() => component.unmount());
  });

  test('updates its identity and values for relevant display settings', () => {
    const values: ReturnType<typeof useScaledStyles>[] = [];

    function Probe() {
      values.push(useScaledStyles());
      return React.createElement('Probe');
    }

    let component!: renderer.ReactTestRenderer;
    renderer.act(() => {
      component = renderer.create(React.createElement(Probe));
    });
    renderer.act(() => {
      useDisplayStore.getState().setButtonSize('small');
    });

    expect(values).toHaveLength(2);
    expect(values[1]).not.toBe(values[0]);
    expect(values[1].buttonH).toBe(40);
    expect(values[1].buttonFont).toBe(13);
    expect(values[1].buttonPadH).toBe(12);
    renderer.act(() => component.unmount());
  });

  test('publishes a new identity after a runtime Dynamic Type change', () => {
    const values: ReturnType<typeof useScaledStyles>[] = [];

    function Probe({ tick }: { tick: number }) {
      values.push(useScaledStyles());
      return React.createElement('Probe', { tick });
    }

    let component!: renderer.ReactTestRenderer;
    renderer.act(() => {
      component = renderer.create(React.createElement(Probe, { tick: 0 }));
    });
    jest.mocked(PixelRatio.getFontScale).mockReturnValue(1.25);
    expect(values[0].fontSize(16)).toBe(20);
    renderer.act(() => {
      component.update(React.createElement(Probe, { tick: 1 }));
    });

    expect(values).toHaveLength(2);
    expect(values[1]).not.toBe(values[0]);
    expect(values[1].fontSize(16)).toBe(20);
    renderer.act(() => component.unmount());
  });
});
