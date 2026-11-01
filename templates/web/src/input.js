// Physical-key input (event.code), mapped to actions. Layout-independent and remappable.
export const DEFAULT_BINDINGS = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Space: 'fire',
  KeyS: 'save',
  KeyL: 'load',
  F3: 'debug',
}

const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'])

export class Input {
  constructor(target, bindings = DEFAULT_BINDINGS) {
    this.bindings = bindings
    this.down = new Set()
    this.pressed = new Set()
    this.error = null
    target.addEventListener('keydown', (e) => {
      const action = this.bindings[e.code]
      if (!action) return
      if (PREVENT.has(e.code)) e.preventDefault()
      if (!this.down.has(action)) this.pressed.add(action)
      this.down.add(action)
    })
    target.addEventListener('keyup', (e) => {
      const action = this.bindings[e.code]
      if (action) this.down.delete(action)
    })
    target.addEventListener('blur', () => this.down.clear())
  }

  /** one snapshot per tick: the simulation never reads the DOM */
  snapshot() {
    return {
      up: this.down.has('up'),
      down: this.down.has('down'),
      left: this.down.has('left'),
      right: this.down.has('right'),
      fire: this.down.has('fire'),
      pressed: new Set(this.pressed),
    }
  }

  endTick() {
    this.pressed.clear()
  }
}
