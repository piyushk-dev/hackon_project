/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { FloorPlan2D } from './FloorPlan2D.js';

function setupDOM() {
  document.head.innerHTML = '';
  document.body.innerHTML = '<div id="floor-root" style="width: 900px; height: 620px;"></div>';
  return document.getElementById('floor-root');
}

describe('FloorPlan2D', () => {
  let container;

  beforeEach(() => {
    container = setupDOM();
  });

  it('renders the isometric house with rooms and clickable device components', () => {
    new FloorPlan2D(container);

    expect(container.querySelector('.iso-stage')).not.toBeNull();
    expect(container.querySelector('svg.iso-svg')).not.toBeNull();
    expect(container.querySelectorAll('.iso-room')).toHaveLength(7);
    expect(container.querySelector('.iso-room[data-room-id="living_room"]')).not.toBeNull();
    expect(container.querySelector('.iso-room[data-room-id="bath"]')).not.toBeNull();
    expect(container.querySelectorAll('.iso-room-label')).toHaveLength(7);

    const devices = container.querySelectorAll('.iso-device');
    expect(devices.length).toBeGreaterThan(10);
    expect(devices[0].tagName).toBe('BUTTON');
  });

  it('opens component details and toggles local device state on device click', () => {
    new FloorPlan2D(container);

    const ac = container.querySelector('[data-device-id="living_room_ac"]');
    ac.click();

    expect(ac.classList.contains('selected')).toBe(true);
    expect(container.querySelector('.iso-info-card').textContent).toContain('AC');
    expect(container.querySelector('.iso-info-card').textContent).toContain('Off');

    container.querySelector('[data-action="toggle"]').click();

    expect(ac.dataset.state).toBe('on');
    expect(container.querySelector('.iso-info-card').textContent).toContain('Cooling');
  });

  it('opens room details with clickable components inside the room', () => {
    new FloorPlan2D(container);

    container.querySelector('.iso-room-label[data-room-label="living_room"]').click();

    const roomInfo = container.querySelector('.iso-info-card');
    expect(roomInfo.textContent).toContain('Living Room');
    expect(roomInfo.querySelectorAll('.iso-info-device').length).toBeGreaterThan(0);

    roomInfo.querySelector('[data-device-id="smart_tv"]').click();

    expect(container.querySelector('.iso-info-card').textContent).toContain('TV');
  });
});
