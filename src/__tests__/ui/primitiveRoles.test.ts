/**
 * Accessibility contract for the UI primitives.
 *
 * VoiceOver is the only way some staff use the app, so every primitive owns a
 * role, a label and, where it can be chosen, a selected state. These tests are
 * the guard against a sweep dropping one while restyling a screen.
 */
import React from 'react';
import renderer, { type ReactTestInstance } from 'react-test-renderer';

jest.mock('react-native', () => require('./nativeMocks').reactNative());
jest.mock('@expo/vector-icons', () => require('./nativeMocks').vectorIcons());
jest.mock('react-native-safe-area-context', () => require('./nativeMocks').safeAreaContext());
jest.mock('@/hooks/useScaledStyles', () => require('./nativeMocks').scaledStyles());
jest.mock('@/components/LoadingIndicator', () => require('./nativeMocks').loadingIndicator());
jest.mock('@/components/BottomSheetShell', () => require('./nativeMocks').bottomSheetShell());

// The mocks above must land before the primitives load.
/* eslint-disable import/first */
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { ListRow } from '@/components/ui/ListRow';
import { Loading } from '@/components/ui/Loading';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Segment } from '@/components/ui/Segment';
import { Sheet } from '@/components/ui/Sheet';
import { StatusPill } from '@/components/ui/StatusPill';
import { TabBar } from '@/components/ui/TabBar';
/* eslint-enable import/first */

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function render(element: React.ReactElement): ReactTestInstance {
  let tree!: renderer.ReactTestRenderer;
  renderer.act(() => {
    tree = renderer.create(element);
  });
  return tree.root;
}

/**
 * Host elements only. The react-native stubs are forwardRef wrappers that
 * spread their props onto a host element, so an unfiltered `findAll` returns
 * every match twice.
 */
function hosts(root: ReactTestInstance, match: (node: ReactTestInstance) => boolean) {
  return root.findAll((node) => typeof node.type === 'string' && match(node));
}

function withRole(root: ReactTestInstance, role: string): ReactTestInstance[] {
  return hosts(root, (node) => node.props.accessibilityRole === role);
}

/** Host stubs are plain strings, which `findAllByType` will not accept. */
function byHost(root: ReactTestInstance, name: string): ReactTestInstance[] {
  return hosts(root, (node) => node.type === name);
}

function labels(nodes: ReactTestInstance[]): (string | undefined)[] {
  return nodes.map((node) => node.props.accessibilityLabel);
}

describe('Button', () => {
  it('is a button with its label and no disabled state', () => {
    const root = render(React.createElement(Button, { label: 'Send order', onPress: jest.fn() }));
    const [button] = withRole(root, 'button');
    expect(button.props.accessibilityLabel).toBe('Send order');
    expect(button.props.accessibilityState).toEqual({ disabled: false, busy: false });
  });

  it('reports busy and disabled while loading', () => {
    const onPress = jest.fn();
    const root = render(
      React.createElement(Button, { label: 'Send order', onPress, loading: true }),
    );
    const [button] = withRole(root, 'button');
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(button.props.disabled).toBe(true);
    expect(byHost(root, 'LoadingIndicator')).toHaveLength(1);
  });

  it('reports disabled and does not fire', () => {
    const onPress = jest.fn();
    const root = render(
      React.createElement(Button, { label: 'Create link', onPress, disabled: true }),
    );
    const [button] = withRole(root, 'button');
    expect(button.props.accessibilityState.disabled).toBe(true);
    expect(button.props.disabled).toBe(true);
  });

  it('keeps a 44pt target on the 34pt small size', () => {
    const root = render(
      React.createElement(Button, { label: 'Add', onPress: jest.fn(), size: 'small' }),
    );
    const [button] = withRole(root, 'button');
    const style = button.props.style[0] as { height: number };
    expect(style.height).toBe(34);
    expect(button.props.hitSlop).toEqual({ top: 5, bottom: 5, left: 5, right: 5 });
  });
});

describe('Chip', () => {
  it('is a button carrying its selected state', () => {
    const root = render(
      React.createElement(Chip, { label: 'Submitted', selected: true, onPress: jest.fn() }),
    );
    const [chip] = withRole(root, 'button');
    expect(chip.props.accessibilityLabel).toBe('Submitted');
    expect(chip.props.accessibilityState).toEqual({ selected: true });
  });

  it('folds the count into the label', () => {
    const root = render(
      React.createElement(Chip, { label: 'All', count: 3, onPress: jest.fn() }),
    );
    const [chip] = withRole(root, 'button');
    expect(chip.props.accessibilityLabel).toBe('All, 3');
    expect(chip.props.accessibilityState).toEqual({ selected: false });
  });
});

describe('Segment', () => {
  it('is a radiogroup of radios with exactly one selected', () => {
    const onChange = jest.fn();
    const root = render(
      React.createElement(Segment, {
        accessibilityLabel: 'Station',
        value: 'sushi',
        onChange,
        options: [
          { value: 'sushi', label: 'Sushi' },
          { value: 'poki', label: 'Poki & Pho' },
          { value: 'both', label: 'Both' },
        ],
      }),
    );
    const [group] = withRole(root, 'radiogroup');
    expect(group.props.accessibilityLabel).toBe('Station');

    const radios = withRole(root, 'radio');
    expect(labels(radios)).toEqual(['Sushi', 'Poki & Pho', 'Both']);
    expect(radios.filter((node) => node.props.accessibilityState.selected)).toHaveLength(1);
    expect(radios[0].props.accessibilityState).toEqual({ selected: true, checked: true });

    radios[2].props.onPress();
    expect(onChange).toHaveBeenCalledWith('both');
  });
});

describe('StatusPill', () => {
  it('announces the status and never relies on colour alone', () => {
    const root = render(React.createElement(StatusPill, { status: 'fulfilled' }));
    const [pill] = withRole(root, 'text');
    expect(pill.props.accessibilityLabel).toBe('Status: Fulfilled');
    // The dot plus the word: the word is always rendered.
    expect(byHost(root, 'Text')[0].props.children).toBe('Fulfilled');
  });

  it('announces an override label too', () => {
    const root = render(
      React.createElement(StatusPill, { status: 'fulfilled', label: '1 ready' }),
    );
    expect(withRole(root, 'text')[0].props.accessibilityLabel).toBe('Status: 1 ready');
  });
});

describe('ScreenHeader', () => {
  it('marks a root title as a header and renders no back button', () => {
    const root = render(React.createElement(ScreenHeader, { title: 'Checklist' }));
    expect(labels(withRole(root, 'header'))).toEqual([undefined]);
    expect(withRole(root, 'header')[0].props.children).toBe('Checklist');
    expect(withRole(root, 'button')).toHaveLength(0);
  });

  it('gives a pushed screen a labelled back button', () => {
    const onBack = jest.fn();
    const root = render(
      React.createElement(ScreenHeader, {
        title: 'Invite someone',
        mode: 'pushed',
        subtitle: 'They set up their own app from the link',
        onBack,
      }),
    );
    const [back] = withRole(root, 'button');
    expect(back.props.accessibilityLabel).toBe('Back');
    back.props.onPress();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('owns the top safe-area padding', () => {
    const root = render(React.createElement(ScreenHeader, { title: 'Checklist' }));
    const style = byHost(root, 'View')[0].props.style[0] as { paddingTop: number };
    expect(style.paddingTop).toBe(47 + 4);
  });
});

describe('TabBar', () => {
  const tabs = [
    { name: 'home', label: 'Home', icon: 'home-outline' as const },
    { name: 'quick', label: 'Quick', icon: 'flash-outline' as const },
    { name: 'fulfillment', label: 'Fulfillment', icon: 'clipboard-outline' as const, badge: 2 },
    { name: 'settings', label: 'Settings', icon: 'person-circle-outline' as const },
  ];

  it('is a tablist of tabs with one selected', () => {
    const onPress = jest.fn();
    const root = render(
      React.createElement(TabBar, { tabs, active: 'fulfillment', onPress }),
    );
    expect(withRole(root, 'tablist')).toHaveLength(1);

    const items = withRole(root, 'tab');
    expect(items).toHaveLength(4);
    expect(items.filter((node) => node.props.accessibilityState.selected)).toHaveLength(1);
    expect(items[2].props.accessibilityState.selected).toBe(true);
  });

  it('speaks the badge count instead of leaving it visual', () => {
    const root = render(
      React.createElement(TabBar, { tabs, active: 'home', onPress: jest.fn() }),
    );
    expect(labels(withRole(root, 'tab'))).toEqual([
      'Home',
      'Quick',
      'Fulfillment, 2 waiting',
      'Settings',
    ]);
  });

  it('adds the quick actions button only when asked', () => {
    const onQuick = jest.fn();
    const plain = render(React.createElement(TabBar, { tabs, active: 'home', onPress: jest.fn() }));
    expect(withRole(plain, 'button')).toHaveLength(0);

    const root = render(
      React.createElement(TabBar, {
        tabs,
        active: 'home',
        onPress: jest.fn(),
        quickActions: { onPress: onQuick },
      }),
    );
    const [dots] = withRole(root, 'button');
    expect(dots.props.accessibilityLabel).toBe('Quick actions');
    dots.props.onPress();
    expect(onQuick).toHaveBeenCalledTimes(1);
  });
});

describe('EmptyState', () => {
  it('marks its title as a header and its action as a button', () => {
    const onPress = jest.fn();
    const root = render(
      React.createElement(EmptyState, {
        icon: 'file-tray-outline',
        title: 'No orders yet',
        body: 'Orders you send appear here.',
        action: { label: 'Retry', onPress },
      }),
    );
    expect(withRole(root, 'header')[0].props.children).toBe('No orders yet');
    expect(labels(withRole(root, 'button'))).toEqual(['Retry']);
  });
});

describe('Loading', () => {
  it('labels the inline spinner', () => {
    const root = render(React.createElement(Loading, { size: 'inline', label: 'Sending' }));
    expect(hosts(root, (node) => node.props.accessibilityLabel === 'Sending')).toHaveLength(1);
    expect(byHost(root, 'LoadingIndicator')).toHaveLength(1);
  });

  it('centres the screen spinner', () => {
    const root = render(React.createElement(Loading, {}));
    const style = byHost(root, 'View')[0].props.style[0] as { justifyContent: string };
    expect(style.justifyContent).toBe('center');
  });
});

describe('Sheet', () => {
  it('renders nothing until visible, then a header and one action', () => {
    const hidden = render(
      React.createElement(Sheet, { visible: false, title: 'Add a note', onClose: jest.fn() }),
    );
    expect(byHost(hidden, 'BottomSheetShell')).toHaveLength(0);

    const onPress = jest.fn();
    const root = render(
      React.createElement(Sheet, {
        visible: true,
        title: 'Add a note',
        onClose: jest.fn(),
        primary: { label: 'Save note', onPress },
      }),
    );
    expect(withRole(root, 'header')[0].props.children).toBe('Add a note');
    expect(labels(withRole(root, 'button'))).toEqual(['Save note']);
  });
});

describe('ListRow', () => {
  it('is a button that announces title and subtitle together when pressable', () => {
    const onPress = jest.fn();
    const root = render(
      React.createElement(ListRow, {
        title: 'Order reminders',
        subtitle: 'Not set',
        icon: 'notifications-outline',
        chevron: true,
        onPress,
      }),
    );
    const [row] = withRole(root, 'button');
    expect(row.props.accessibilityLabel).toBe('Order reminders, Not set');
    row.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes no role when it is not pressable', () => {
    const root = render(React.createElement(ListRow, { title: 'Fixture Salmon' }));
    expect(withRole(root, 'button')).toHaveLength(0);
  });
});

describe('Input', () => {
  it('labels the field from its section label', () => {
    const root = render(
      React.createElement(Input, { label: 'Name', placeholder: 'First name, like on the schedule' }),
    );
    const [field] = byHost(root, 'TextInput');
    expect(field.props.accessibilityLabel).toBe('Name');
    expect(withRole(root, 'header')[0].props.children).toBe('Name');
  });

  it('falls back to the placeholder and announces errors', () => {
    const root = render(
      React.createElement(Input, { placeholder: 'Your name', error: 'Enter a name' }),
    );
    expect(byHost(root, 'TextInput')[0].props.accessibilityLabel).toBe('Your name');
    const [alert] = withRole(root, 'alert');
    expect(alert.props.children).toBe('Enter a name');
  });
});

describe('Card and SectionLabel', () => {
  it('does not swallow the accessibility tree', () => {
    const root = render(
      React.createElement(Card, null, React.createElement(SectionLabel, null, 'Fish & seafood')),
    );
    expect(withRole(root, 'header')[0].props.children).toBe('Fish & seafood');
  });
});
