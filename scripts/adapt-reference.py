from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
public = root / 'public'
sources = sorted((public / 'assets').glob('main-*.js'))
if len(sources) != 1:
    raise SystemExit('Expected one authorized reference runtime in public/assets.')

original = sources[0]
source = original.read_text()
local = 'OFFLINE_LOCAL_EDITION'
if local not in source:
    source = '/* ' + local + ' */\n' + source
    source = source.replace('DRAW A ZERO', 'DRAW A LOOP')
    source = source.replace('https://learnwithzero.com/letters.html', '/credits.html')
    source = re.sub(r'https://learnwithzero\.com/[^"\x27`\s<]*', '/object.html', source)
    source = source.replace('https://why.zero.university/', '/')
    source = re.sub(r'https://[a-z0-9-]+\.supabase\.co', 'http://127.0.0.1:4173/__local', source)
    source = re.sub(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{30,}', 'offline-demo', source)

    # Keep the authored camera and rendered art. Insert the OFFLINE shots at
    # existing segment boundaries.
    timeline = 'this.ctx=e,this.segments=t,this.isActive=!1'
    assert source.count(timeline) == 1
    local_timeline = """
this.ctx=e,this.segments=t.map((segment) => {
  if (segment.id === "gate3to4") {
    return {
      ...segment,
      scrub(context, progress) {
        segment.scrub(context, Math.min(progress, 0.842));
        if (progress >= 0.835) window.dispatchEvent(new Event("offline:object"));
      },
    };
  }
  if (segment.id === "stage4") {
    return {
      ...segment,
      async enter(context) {
        await segment.enter(context);
        if (context.components?.world) context.components.world.visible = false;
      },
      scrub(context, progress) {
        segment.scrub(context, Math.min(progress, 0.73));
        if (context.components?.world) context.components.world.visible = false;
        if (progress >= 0.73) window.dispatchEvent(new Event("offline:object"));
      },
    };
  }
  if (segment.id === "stage5") {
    return {
      id: "stage5",
      scrollVh: 50,
      autoScroll: false,
      enter() { window.dispatchEvent(new Event("offline:object")); },
    };
  }
  return segment;
}),this.isActive=!1
""".strip()
    source = source.replace(timeline, local_timeline)
    stage_hook = 'this._ruler.setActiveSegment(e?e.id:null);'
    if source.count(stage_hook) == 1:
        source = source.replace(stage_hook, stage_hook + 'if(e){document.body.dataset.filmStage=e.id}')
    editorial = 'this.hasVisibleSprites=r,this.group.visible=r'
    assert source.count(editorial) == 1
    source = source.replace(editorial, 'this.hasVisibleSprites=r,this.group.visible=!1')
    source = re.sub(r'video:`(?:Nike|ChatGPT|Google|Spotify)-Card\.mp4`', 'video:``', source)
    source = source.replace('t.alt=`ZERO`,t.className=`loader-logo`', 't.alt=`OFFLINE`,t.className=`loader-logo`')
    source += """
;window.addEventListener("offline:trace", (event) => {
  const { action, x, y } = event.detail || {};
  if (!Nk.isReady || Nk.isComplete) return;
  if (action === "down") Qk({ clientX: x, clientY: y });
  if (action === "move") Zk({ clientX: x, clientY: y });
  if (action === "up") $k();
});
"""
    # Grade only the source garden composite and its matching video handoff.
    # The hands are rendered into the foreground texture upstream.
    dusk = """
    vec3 offlineDusk(vec3 rgb, vec2 point) {
        float lum = max(0.0, dot(rgb, vec3(0.2126, 0.7152, 0.0722)));
        float warm = exp(-dot((point - vec2(0.78, 0.50)) * vec2(1.72, 3.0),
                             (point - vec2(0.78, 0.50)) * vec2(1.72, 3.0)));
        warm *= smoothstep(0.23, 0.91, lum) * 0.88;
        vec3 cool = vec3(0.17, 0.26, 0.41);
        vec3 amber = vec3(0.82, 0.54, 0.23);
        float value = pow(lum, 0.86);
        vec3 tint = mix(cool, amber, warm) * value + rgb * 0.15;
        return max(vec3(0.0015, 0.002, 0.0035), tint);
    }

"""
    sampler = '    vec4 sampleBgA() {'
    assert source.count(sampler) == 1
    garden = '    vec3 parallaxStack(vec2 base) {'
    assert source.count(garden) == 1
    source = source.replace(garden, dusk + garden)
    previous_garden_color = 'col += glow * glow * uGardenBloom;' + chr(10) + '        return col;'
    dusk_garden_color = 'col += glow * glow * uGardenBloom;' + chr(10) + '        return mix(offlineDusk(col, vUv), col, pow(clamp(uGardenWhitewash, 0.0, 1.0), 2.0));'
    assert source.count(previous_garden_color) == 1
    source = source.replace(previous_garden_color, dusk_garden_color)
    source = source.replace('colorA.rgb = sRGBToLinear(colorA.rgb);',
                            'colorA.rgb = offlineDusk(sRGBToLinear(colorA.rgb), vUv);')
    old_rays = 'finalRGB += rays * uGodRaysOpacity;'
    assert source.count(old_rays) == 1
    source = source.replace(old_rays, 'finalRGB += rays * uGodRaysOpacity * vec3(0.53, 0.35, 0.19);')
    source = source.replace('innerColor:`#42ffb7`,innerEmissive:`#004216`',
                            'innerColor:`#f5a261`,innerEmissive:`#873609`')
    tunnel_start = source.index('function uS(e)')
    tunnel_end = source.index('gS=2048;', tunnel_start)
    copper = str(0xFFC081)
    key = str(0xF5904F)
    tunnel = source[tunnel_start:tunnel_end].replace('10336677', copper).replace('10208172', key)
    source = source[:tunnel_start] + tunnel + source[tunnel_end:]
    for key, name, replacement in (
        ('spcAtlas', 'shards-petals-coins', 'distraction-shards'),
        ('certAtlas', 'board-certificates', 'reports-and-signal'),
        ('moneyShredsAtlas', 'leather-money-shreds', 'reports-and-money'),
    ):
        target = f'type:`ktx2`,key:`{key}`,path:`assets/atlases/{name}.ktx2`'
        assert source.count(target) == 1
        source = source.replace(target, f'type:`texture`,key:`{key}`,path:`assets/offline-atlases/{replacement}.webp`')
    source = source.replace('/assets/textures/origami_certificate.webp', '/assets/offline-atlases/folded-report.webp')

    start = source.index('_setupEthHand(e,t){')
    end = source.index('_setupHumanHand(e,t){', start)
    hand = source[start:end]
    append_uniform = 'e.uniforms.uRippleTime=u.uRippleTime,'
    assert hand.count(append_uniform) == 1
    color_uniforms = '''e.uniforms.uOfflineHandDark={ value:new K(...(window.OFFLINE_PALETTE?.dark||[.13,.059,.032])) },
e.uniforms.uOfflineHandLight={ value:new K(...(window.OFFLINE_PALETTE?.light||[.83,.54,.32])) },
'''
    hand = hand.replace(append_uniform, color_uniforms + append_uniform)
    hand = hand.replace('uniform float uRippleTime;', 'uniform float uRippleTime; uniform vec3 uOfflineHandDark; uniform vec3 uOfflineHandLight;')
    hand_shade = '''{
            float metalTone = dot(gl_FragColor.rgb,vec3(.2126,.7152,.0722));
            vec3 base = mix(uOfflineHandDark,uOfflineHandLight,smoothstep(.035,.96,metalTone));
            float sheen = smoothstep(.69,1.0,metalTone);
            gl_FragColor.rgb = mix(base,vec3(.95,.88,.74),sheen*.32);
        }
        if (uRippleIntensity > 0.001) {'''
    hand = hand.replace('if (uRippleIntensity > 0.001) {', hand_shade)
    hand = hand.replace('vec3(0.773, 1.0, 0.796)', 'uOfflineHandLight')
    source = source[:start] + hand + source[end:]
    source = source.replace('innerColor:`#f5a261`', 'innerColor:(window.OFFLINE_PALETTE?.tunnel||`#f5a261`)')
    source = source.replace(f'new q({copper})', f'new q(window.OFFLINE_PALETTE?.glow||{copper})')
    source = source.replace('function hA(){$O&&$O.begin()', 'function hA(){if(document.body.classList.contains("offline-object-open"))return;$O&&$O.begin()')
if 'OFFLINE_BAKED_HAND_COLOR' not in source:
    start = source.index('Iv=`')
    end = source.index('function Lv(', start)
    baked_hand = source[start:end]
    baked_hand = baked_hand.replace('uniform float uOpacity;', '''
    uniform float uOpacity;
    uniform vec3 uOfflineHandDark;
    uniform vec3 uOfflineHandLight;
    // OFFLINE_BAKED_HAND_COLOR
''', 1)
    black = 'vec3 outRGB = pMix.rgb * uOpacity * alphaMask;'
    assert baked_hand.count(black) == 1
    baked_hand = baked_hand.replace(black, '''
        vec3 lit = pMix.rgb / max(pMix.a, .001);
        float brightness = dot(lit, vec3(.34,.51,.15));
        vec3 metal = mix(uOfflineHandDark, uOfflineHandLight, smoothstep(.023, .74, brightness));
        metal = mix(metal, vec3(.9,.92,.94), smoothstep(.69, .97, brightness)*.28);
        vec3 outRGB = metal * outA;
''')
    baked_hand = baked_hand.replace('vec3(0.773, 1.0, 0.796)', 'uOfflineHandLight')
    source = source[:start] + baked_hand + source[end:]
    key = 'function Lv({useRipple:e=!0}={}){let t={'
    assert source.count(key) == 1
    source = source.replace(key, key + '''uOfflineHandDark:{value:new K(...window.OFFLINE_PALETTE.dark)},
uOfflineHandLight:{value:new K(...window.OFFLINE_PALETTE.light)},''')
    hook = 'r&&a.normalScale.copy(r),this.group.traverse(e=>{(e.isMesh||e.isSkinnedMesh)&&(e.material=a)}),this._material=a'
    assert source.count(hook) == 1
    source = source.replace(hook, '''r&&a.normalScale.copy(r),a.onBeforeCompile=e=>{
      e.uniforms.uOfflineHandDark={value:new K(...window.OFFLINE_PALETTE.dark)};
      e.uniforms.uOfflineHandLight={value:new K(...window.OFFLINE_PALETTE.light)};
      e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
        uniform vec3 uOfflineHandDark;
        uniform vec3 uOfflineHandLight;`);
      e.fragmentShader=e.fragmentShader.replace(`#include <dithering_fragment>`,`
        float brightness=dot(gl_FragColor.rgb,vec3(.2126,.7152,.0722));
        gl_FragColor.rgb=mix(uOfflineHandDark,uOfflineHandLight,smoothstep(.03,.94,brightness));
        #include <dithering_fragment>`);
    },this.group.traverse(e=>{(e.isMesh||e.isSkinnedMesh)&&(e.material=a)}),this._material=a''')

# OFFLINE editorial treatment. Preserve native gesture, scroll, and gate timing.
film_hooks = (
    (
        't.scrub&&t.scrub(this.ctx,a),t.holdTrigger&&!t.autoScroll',
        't.scrub&&t.scrub(this.ctx,a),window.OFFLINE_FILM_CUE?.(t.id,a),t.holdTrigger&&!t.autoScroll',
    ),
    (
        'this.mesh.visible=!0;let r=window.innerWidth<768',
        'if(window.OFFLINE_FILM_CUE){this.mesh.visible=!1,this._texture.needsUpdate=!0;return}this.mesh.visible=!0;let r=window.innerWidth<768',
    ),
    (
        'let e=t>.25;n.petalParticles.group.visible=e,e&&n.petalParticles.setEntry(hv(t,.25,.85))',
        'n.petalParticles.group.visible=!1',
    ),
    (
        'segment.scrub(context, Math.min(progress, 0.842));',
        '''segment.scrub(context, Math.min(progress, 0.842));
        window.OFFLINE_FILM_CUE?.("gate3to4", progress);''',
    ),
    (
        'this.audioBtn=null,e||this._createAudioToggle(),this._rightGroup=',
        'this.audioBtn=null,this._createAudioToggle(),this._rightGroup=',
    ),
    (
        'e?this._leftGroup.appendChild(this.xpCounter):(this._leftGroup.appendChild(this.audioBtn),',
        'e?(this._leftGroup.appendChild(this.audioBtn),this._leftGroup.appendChild(this.xpCounter)):(this._leftGroup.appendChild(this.audioBtn),',
    ),
)
for before, after in film_hooks:
    if after not in source:
        assert source.count(before) == 1, f'Expected exactly one editorial hook: {before}'
        source = source.replace(before, after)

if source != original.read_text():
    original.write_text(source)
