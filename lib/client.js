// dsh-desktop-notify — client half.
//
// The "Desktop notifications" card in Settings → Plugins → Plugin configuration:
// a master on/off switch, per-event toggles, and the sound preset picker for
// critical popups. Writes go straight to the settings document through the
// bound scope (one field write per change; revision fencing is handled by the
// scope), so edits apply in the running host without a restart.
//
// Plain browser bundle in the dsh client module format: the factory registers
// under this package's name and exports a Cordis plugin. No JSX, no TS —
// React comes from the browser module table via the injected require.
window.__ModuleLoader__.load({
  id: 'dsh-desktop-notify',
  factory: (require) => {
    var module = { exports: {} }
    var React = require('react')

    var name = 'dsh-desktop-notify'
    var NS = 'desktop-notify'
    var inject = ['slots', 'locale']

    // Must stay in sync with SOUND_PRESETS in lib/index.js.
    var PRESETS = ['complete', 'bell', 'attention', 'message', 'warning', 'error']

    var DICT_EN = {
      title: 'Desktop notifications',
      description: 'Popups and sounds when something notable happens in your sessions.',
      eventsTitle: 'When to notify',
      soundTitle: 'Sound',
      soundEnabled: 'Play a sound with critical popups',
      soundName: 'Sound',
      preview: 'Preview this sound in the browser (approximation — the real file plays on your desktop)',
      events_notifyTurnEnd: 'Task finished',
      events_notifyTurnEnd_hint: 'Banner when a root turn completes.',
      events_notifyTurnError: 'Task failed or interrupted',
      events_notifyTurnError_hint: 'Errors get a sticky popup, interruptions a banner.',
      events_notifyApproval: 'Approval requested',
      events_notifyApproval_hint: 'Sticky popup when a tool asks for permission.',
      events_notifyToolError: 'Tool call failed',
      events_notifyToolError_hint: 'Banner per failing tool, with a cooldown.',
      events_notifyWorkflowEnd: 'Workflow finished',
      events_notifyWorkflowEnd_hint: 'Banner when a workflow run ends.',
      events_notifyGoalComplete: 'Goal completed',
      events_notifyGoalComplete_hint: 'Banner with the goal objective.',
      events_notifyGoalBlocked: 'Goal blocked',
      events_notifyGoalBlocked_hint: 'Sticky popup when a goal blocks.',
      events_notifySubagentEnd: 'Subagent finished',
      events_notifySubagentEnd_hint: 'Banner when a subagent turn ends (off by default).',
      advancedTitle: 'Advanced',
      toolErrorAllowlist: 'Tool error allowlist',
      toolErrorAllowlist_hint: 'Only these tools notify; comma-separated names, empty = all.',
      toolErrorCooldownMs: 'Tool error cooldown (ms)',
      toolErrorCooldownMs_hint: 'Minimum milliseconds between tool-failure banners per session.',
      appName: 'App name',
      appName_hint: "Shown as the notification's application name; empty = default.",
      soundFile: 'Custom sound file',
      soundFile_hint: 'Path to your own sound file; empty = use the preset above.',
      sounds_complete: 'Complete (chime)',
      sounds_bell: 'Bell',
      sounds_attention: 'Attention',
      sounds_message: 'Message',
      sounds_warning: 'Warning',
      sounds_error: 'Error (low)'
    }

    var DICT_ZH = {
      title: '桌面通知',
      description: '会话中发生重要事件时，在桌面弹出通知并播放提示音。',
      eventsTitle: '通知时机',
      soundTitle: '提示音',
      soundEnabled: '关键弹窗时播放提示音',
      soundName: '声音',
      preview: '在浏览器中试听（近似音；实际声音在你的桌面播放）',
      events_notifyTurnEnd: '任务完成',
      events_notifyTurnEnd_hint: '根会话回合完成时显示横幅。',
      events_notifyTurnError: '任务失败或被中断',
      events_notifyTurnError_hint: '错误弹出常驻弹窗，中断显示横幅。',
      events_notifyApproval: '需要审批',
      events_notifyApproval_hint: '工具请求权限时弹出常驻弹窗。',
      events_notifyToolError: '工具调用失败',
      events_notifyToolError_hint: '单个工具失败时显示横幅（带冷却）。',
      events_notifyWorkflowEnd: '工作流结束',
      events_notifyWorkflowEnd_hint: '工作流运行结束时显示横幅。',
      events_notifyGoalComplete: '目标完成',
      events_notifyGoalComplete_hint: '显示目标内容的横幅。',
      events_notifyGoalBlocked: '目标受阻',
      events_notifyGoalBlocked_hint: '目标受阻时弹出常驻弹窗。',
      events_notifySubagentEnd: '子代理结束',
      events_notifySubagentEnd_hint: '子代理回合结束时显示横幅（默认关闭）。',
      advancedTitle: '高级设置',
      toolErrorAllowlist: '工具失败白名单',
      toolErrorAllowlist_hint: '仅这些工具会通知；逗号分隔名称，留空表示全部。',
      toolErrorCooldownMs: '工具失败冷却（毫秒）',
      toolErrorCooldownMs_hint: '同一会话内两次工具失败横幅的最小间隔（毫秒）。',
      appName: '应用名称',
      appName_hint: '通知中显示的应用名称；留空 = 使用默认值。',
      soundFile: '自定义声音文件',
      soundFile_hint: '自己的声音文件路径；留空 = 使用上方预设。',
      sounds_complete: '完成（双音）',
      sounds_bell: '铃声',
      sounds_attention: '提醒',
      sounds_message: '消息',
      sounds_warning: '警告',
      sounds_error: '错误（低音）'
    }

    // In-browser audition per preset. Each tone is a self-describing object with
    // named fields (freq, offsetSec, durSec, waveType?) rather than a positional
    // array, so previewSound reads named fields instead of positional indices.
    var PREVIEW = {
      complete: [
        { freq: 880, offsetSec: 0, durSec: 0.18 },
        { freq: 1318.5, offsetSec: 0.16, durSec: 0.28 }
      ],
      bell: [
        { freq: 987.77, offsetSec: 0, durSec: 0.5 }
      ],
      attention: [
        { freq: 659.25, offsetSec: 0, durSec: 0.12 },
        { freq: 659.25, offsetSec: 0.18, durSec: 0.12 },
        { freq: 659.25, offsetSec: 0.36, durSec: 0.2 }
      ],
      message: [
        { freq: 523.25, offsetSec: 0, durSec: 0.25 }
      ],
      warning: [
        { freq: 440, offsetSec: 0, durSec: 0.15, waveType: 'square' },
        { freq: 440, offsetSec: 0.2, durSec: 0.2, waveType: 'square' }
      ],
      error: [
        { freq: 196, offsetSec: 0, durSec: 0.25, waveType: 'sawtooth' },
        { freq: 147, offsetSec: 0.28, durSec: 0.35, waveType: 'sawtooth' }
      ]
    }

    var audioCtx = null
    function previewSound(preset) {
      try {
        var AC = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null
        if (!AC) return
        audioCtx = audioCtx || new AC()
        if (audioCtx.state === 'suspended') audioCtx.resume()
        var t0 = audioCtx.currentTime
        var tones = PREVIEW[preset] || PREVIEW.complete
        tones.forEach(function (tone) {
          var osc = audioCtx.createOscillator()
          var gain = audioCtx.createGain()
          osc.type = tone.waveType || 'sine'
          osc.frequency.setValueAtTime(tone.freq, t0 + tone.offsetSec)
          gain.gain.setValueAtTime(0.0001, t0 + tone.offsetSec)
          gain.gain.exponentialRampToValueAtTime(0.2, t0 + tone.offsetSec + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.offsetSec + tone.durSec)
          osc.connect(gain).connect(audioCtx.destination)
          osc.start(t0 + tone.offsetSec)
          osc.stop(t0 + tone.offsetSec + tone.durSec + 0.05)
        })
      } catch (e) {
        // Preview is best-effort: log at warn level instead of dropping silently,
        // but never break the card over audio.
        console.warn("[dsh-desktop-notify] preview failed:", e && e.message ? e.message : e)
      }
    }

    var CSS =
      '.dnd-card{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);border-radius:16px;list-style:none}' +
      '.dnd-head{align-items:center;gap:12px;padding:14px 16px;display:flex}' +
      '.dnd-title{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4;flex:1;min-width:0}' +
      '.dnd-desc{color:var(--dsw-alias-label-tertiary);margin:0;padding:0 16px 8px;font-size:13px;line-height:1.5}' +
      '.dnd-group{border-top:.5px solid var(--dsw-alias-border-l2);padding:8px 0 4px}' +
      '.dnd-group-title{color:var(--dsw-alias-label-secondary);padding:4px 16px;font-size:12px;font-weight:600;letter-spacing:.4px;text-transform:uppercase}' +
      '.dnd-field{border-top:.5px solid var(--dsw-alias-border-l2);padding:10px 16px;display:flex;flex-direction:column;gap:8px}' +
      '.dnd-row{align-items:center;gap:16px;font-size:13px;line-height:1.5;display:flex}' +
      '.dnd-label{color:var(--dsw-alias-label-primary);flex:1;min-width:0}' +
      '.dnd-hint{color:var(--dsw-alias-label-tertiary);margin-top:2px;font-size:12px;line-height:1.5;display:block}' +
      '.dnd-check{accent-color:var(--dsw-alias-brand-primary);width:16px;height:16px;flex:none;cursor:pointer;margin:0}' +
      '.dnd-select{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);height:30px;font:inherit;border-radius:8px;padding:0 10px;font-size:13px;cursor:pointer}' +
      '.dnd-select:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}' +
      '.dnd-select:disabled,.dnd-check:disabled,.dnd-input:disabled{opacity:.5;cursor:default}' +
      '.dnd-preview{color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;padding:4px 10px;font-size:12px;line-height:1.5;flex:none}' +
      '.dnd-preview:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}' +
      '.dnd-input{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);height:30px;font:inherit;border-radius:8px;padding:0 10px;font-size:13px;width:240px;flex:none}' +
      '.dnd-input:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}' +
      '.dnd-input-sm{width:96px}'

    function installStyles() {
      var existing = document.getElementById('dsh-desktop-notify/card.css')
      if (existing !== null) return function () {}
      var element = document.createElement('style')
      element.id = 'dsh-desktop-notify/card.css'
      element.textContent = CSS
      document.head.appendChild(element)
      return function () {
        if (element.parentNode !== null) element.parentNode.removeChild(element)
      }
    }

    function makeCard(t, scope) {
      var setField = function (field, value) {
        try { scope.set(field, value) } catch (e) {
          // Best-effort write: log at warn level instead of dropping silently.
          // The scope still fences it, so the card never breaks over a failed write.
          console.warn("[dsh-desktop-notify] field write failed:", field, e && e.message ? e.message : e)
        }
      }

      // Scope controller methods use `this` — wrap in stable closures so
      // React's plain calls keep the receiver (same pattern as dshmarket).
      var subscribe = function (cb) { return scope.subscribe(cb) }
      var getSnapshot = function () { return scope.getSnapshot() }

      function Card(props) {
        var snap = React.useSyncExternalStore(subscribe, getSnapshot)
        if (!snap || snap.status !== 'ready') return null
        var value = snap.value || {}
        var disabled = snap.writable === false

        var check = function (field, on) {
          return React.createElement('input', {
            type: 'checkbox',
            className: 'dnd-check',
            checked: !!on,
            disabled: disabled,
            onChange: function (e) { setField(field, e.target.checked) }
          })
        }

        // Shared row skeleton: label (+hint) and a control. Checkbox rows use
        // a real <label> so clicking the text toggles the check; text rows
        // use a plain <div>.
        var row = function (field, labelKey, hintKey, control, rowTag) {
          return React.createElement('div', { key: field, className: 'dnd-field' },
            React.createElement(rowTag || 'label', { className: 'dnd-row' },
              React.createElement('span', { className: 'dnd-label' },
                t(labelKey),
                hintKey ? React.createElement('span', { className: 'dnd-hint' }, t(hintKey)) : null
              ),
              control
            )
          )
        }

        var fieldRow = function (field, labelKey, hintKey, on) {
          return row(field, labelKey, hintKey, check(field, on))
        }

        // Text field row: uncontrolled input (defaultValue from the snapshot,
        // so typing keeps what the user entered even when the write normalizes
        // it); edits go through the scope like the toggles.
        var textField = function (field, labelKey, hintKey, display, onEdit, small) {
          return row(field, labelKey, hintKey, React.createElement('input', {
            type: 'text',
            className: small === true ? 'dnd-input dnd-input-sm' : 'dnd-input',
            defaultValue: display,
            disabled: disabled,
            onChange: function (e) { onEdit(e.target.value) }
          }), 'div')
        }

        // The allowlist is a string array in settings but comma-separated text
        // on the card; keep the two-way conversion next to its only use site.
        var formatAllowlist = function (value) { return (Array.isArray(value) ? value : []).join(', ') }
        var parseAllowlist = function (text) { return text.split(/[\s,]+/).filter(Boolean) }

        var soundName = typeof value.soundName === 'string' ? value.soundName : 'complete'

        return React.createElement('li', { className: 'dnd-card' },
          React.createElement('div', { className: 'dnd-head' },
            React.createElement('span', { className: 'dnd-title' }, t('title')),
            check('enabled', value.enabled !== false)
          ),
          React.createElement('p', { className: 'dnd-desc' }, t('description')),

          React.createElement('div', { className: 'dnd-group' },
            React.createElement('div', { className: 'dnd-group-title' }, t('eventsTitle')),
            fieldRow('notifyTurnEnd', 'events_notifyTurnEnd', 'events_notifyTurnEnd_hint', value.notifyTurnEnd),
            fieldRow('notifyTurnError', 'events_notifyTurnError', 'events_notifyTurnError_hint', value.notifyTurnError),
            fieldRow('notifyApproval', 'events_notifyApproval', 'events_notifyApproval_hint', value.notifyApproval),
            fieldRow('notifyToolError', 'events_notifyToolError', 'events_notifyToolError_hint', value.notifyToolError),
            fieldRow('notifyWorkflowEnd', 'events_notifyWorkflowEnd', 'events_notifyWorkflowEnd_hint', value.notifyWorkflowEnd),
            fieldRow('notifyGoalComplete', 'events_notifyGoalComplete', 'events_notifyGoalComplete_hint', value.notifyGoalComplete),
            fieldRow('notifyGoalBlocked', 'events_notifyGoalBlocked', 'events_notifyGoalBlocked_hint', value.notifyGoalBlocked),
            fieldRow('notifySubagentEnd', 'events_notifySubagentEnd', 'events_notifySubagentEnd_hint', value.notifySubagentEnd)
          ),

          React.createElement('div', { className: 'dnd-group' },
            React.createElement('div', { className: 'dnd-group-title' }, t('soundTitle')),
            fieldRow('sound', 'soundEnabled', null, value.sound),
            React.createElement('div', { className: 'dnd-field' },
              React.createElement('div', { className: 'dnd-row' },
                React.createElement('span', { className: 'dnd-label' }, t('soundName')),
                React.createElement('button', {
                  type: 'button',
                  className: 'dnd-preview',
                  title: t('preview'),
                  disabled: disabled || value.sound === false,
                  onClick: function () { previewSound(soundName) }
                }, '▶'),
                React.createElement('select', {
                  className: 'dnd-select',
                  value: soundName,
                  disabled: disabled || value.sound === false,
                  onChange: function (e) { setField('soundName', e.target.value) }
                }, PRESETS.map(function (p) {
                  return React.createElement('option', { key: p, value: p }, t('sounds_' + p))
                }))
              )
            ),
            textField('soundFile', 'soundFile', 'soundFile_hint',
              typeof value.soundFile === 'string' ? value.soundFile : '',
              function (text) { setField('soundFile', text) })
          ),

          React.createElement('div', { className: 'dnd-group' },
            React.createElement('div', { className: 'dnd-group-title' }, t('advancedTitle')),
            textField('toolErrorAllowlist', 'toolErrorAllowlist', 'toolErrorAllowlist_hint',
              formatAllowlist(value.toolErrorAllowlist),
              function (text) { setField('toolErrorAllowlist', parseAllowlist(text)) }),
            textField('toolErrorCooldownMs', 'toolErrorCooldownMs', 'toolErrorCooldownMs_hint',
              typeof value.toolErrorCooldownMs === 'number' ? String(value.toolErrorCooldownMs) : '',
              function (text) {
                if (text.trim() === '') return
                var n = Number(text.trim())
                if (isFinite(n) && n >= 0) setField('toolErrorCooldownMs', n)
              }, true),
            textField('appName', 'appName', 'appName_hint',
              typeof value.appName === 'string' ? value.appName : '',
              function (text) { setField('appName', text) })
          )
        )
      }

      return Card
    }

    function apply(ctx) {
      var disposeStyles = installStyles()

      ctx.effect(function () {
        return ctx.locale.register(NS, { zh: DICT_ZH, en: DICT_EN })
      }, 'dsh-desktop-notify: dictionaries')
      var t = ctx.locale.bind(NS)

      ctx.inject(['settingsScope'], function (c) {
        var binder = c.settingsScope
        if (binder === void 0) return
        var scope = binder.bind({ namespace: NS })
        var Card = makeCard(t, scope)
        var disposeEntry = c.slots.inject('settings.plugin.item', function () {
          return c.slots.register(
            { name: 'settings.plugin.item', key: NS, locale: NS },
            function (props) { return React.createElement(Card, props) }
          )
        })
        ctx.effect(function () {
          return function () { disposeEntry() }
        })
      })

      ctx.effect(function () {
        return function () { disposeStyles() }
      })
    }

    module.exports = { name: name, inject: inject, apply: apply }
    return module.exports
  },
})
