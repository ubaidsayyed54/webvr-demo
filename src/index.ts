import * as THREE from 'three';

import 'webvr-polyfill';

declare function require(string): string;
declare function VRFrameData(): void;

interface ObjectOf<T> {
  [key: string]: T;
}

const de2ra = function(degree) {
  return degree * (Math.PI/180);
}

/* initialize renderer, scene, camera */

const NEAR = 0.1;
const FAR = 1000;
const FLOOR = -0.1;

class App {

  private scene: THREE.Scene;
  private sceneSkybox: THREE.Scene;

  private camera: THREE.PerspectiveCamera;
  private cameraSkybox: THREE.PerspectiveCamera;

  private renderer: THREE.WebGLRenderer;

  private lights: ObjectOf<THREE.Light> = {};
  private objects: ObjectOf<THREE.Object3D> = {};
  private textures: ObjectOf<any> = {};

  private firstVRFrame:boolean = true;
  private vrDisplay:any; /* new api not in typescript typings yet */

  constructor() {
    this.scene = new THREE.Scene();
    this.sceneSkybox = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, NEAR, FAR);
    this.cameraSkybox = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, NEAR, FAR);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0xffffff, 1);
    document.body.appendChild(this.renderer.domElement);
  }

  prepareLight() {
    this.lights['ambient'] = new THREE.AmbientLight(0xffffff, 0.3);
    this.lights['directional'] = new THREE.DirectionalLight(0xffffff, 0.7);
    this.lights['directional'].position.set(20, 10, 0);
    this.scene.add(this.lights['ambient']);
    this.scene.add(this.lights['directional']);
  }

  prepareEffect() {
    this.scene.fog = new THREE.FogExp2(0xffffff, 0.1);
  }

  async prepareTexture() {
    /* skybox texture */
    let cubeLoader = new THREE.CubeTextureLoader();
    this.textures['skybox'] = await cubeLoader.load([
      require('./textures/skybox/dust_rt.jpg'),
      require('./textures/skybox/dust_lf.jpg'),
      require('./textures/skybox/dust_up.jpg'),
      require('./textures/skybox/dust_dn.jpg'),
      require('./textures/skybox/dust_bk.jpg'),
      require('./textures/skybox/dust_ft.jpg')
    ]);
    /* geometry texture */
    let loader = new THREE.TextureLoader();
    this.textures['grass'] = await loader.load(require('./textures/grass.jpg'));
  }

  async prepareGeometry() {
    let loader = new THREE.JSONLoader();
    let loadPromise = (path: string): Promise<THREE.Object3D> => new Promise((resolve, reject) => {
      loader.load(path, (geometry, materials) => {
        resolve(new THREE.Mesh(geometry, new THREE.MultiMaterial(materials)));
      });
    });
    /* tree */
    this.objects['tree'] = await loadPromise(require('file-loader!./models/tree.json'));
    this.objects['tree'].position.set(0, FLOOR, -3);
    this.scene.add(this.objects['tree']);
    /* ground */
    this.objects['ground'] = new THREE.Mesh(
      new THREE.BoxGeometry(5, 5, 0.1, 1, 1, 1),
      new THREE.MeshPhongMaterial({
        map: this.textures['grass']
      })
    );
    this.objects['ground'].rotation.x = de2ra(90);
    this.objects['ground'].position.set(0, FLOOR, -3);
    this.scene.add(this.objects['ground']);
  }

  prepareSkybox() {
    let shader = THREE.ShaderLib['cube'];
    shader.uniforms['tCube'].value = this.textures['skybox'];
    this.objects['skybox'] = new THREE.Mesh(
      new THREE.CubeGeometry(FAR, FAR, FAR, 1, 1, 1),
      new THREE.ShaderMaterial({
        fragmentShader: shader.fragmentShader,
        vertexShader: shader.vertexShader,
        uniforms: shader.uniforms,
        depthWrite: false,
        side: THREE.BackSide
      })
    )
    this.sceneSkybox.add(this.objects['skybox']);
  }

  partialRender(
    projectionMatrix: number[],
    viewMatrix: number[],
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    if (projectionMatrix && viewMatrix) {
      this.camera.projectionMatrix.fromArray(projectionMatrix);
      this.cameraSkybox.projectionMatrix.fromArray(projectionMatrix);
      this.scene.matrix.fromArray(viewMatrix);
      this.sceneSkybox.matrix.fromArray(viewMatrix);
      this.scene.updateMatrixWorld(true);
      this.sceneSkybox.updateMatrixWorld(true);
    }

    this.renderer.setViewport(x, y, width, height);
    this.renderer.render(this.sceneSkybox, this.cameraSkybox);
    this.renderer.render(this.scene, this.camera);
  }

  update() {
  }

  render() {
    if (this.firstVRFrame) {
      this.firstVRFrame = false;
      if (this.vrDisplay) {
        return this.vrDisplay.requestAnimationFrame(this.render.bind(this));
      } else {
        return requestAnimationFrame(this.render.bind(this));
      }
    }

    this.renderer.clear();
    this.update();

    if (!this.vrDisplay || this.vrDisplay.isPresenting == false) { // if not in VR mode, only render the left halve
      this.renderer.autoClear = false;
      this.scene.matrixAutoUpdate = true;
      this.sceneSkybox.matrixAutoUpdate = true;
      this.camera.matrixAutoUpdate = true;
      this.cameraSkybox.matrixAutoUpdate = true;
      this.partialRender(
        null,
        null,
        0,
        0,
        window.innerWidth,
        window.innerHeight
      );
      requestAnimationFrame(this.render.bind(this));
      return;
    }

    this.vrDisplay.requestAnimationFrame(this.render.bind(this));

    // get the vr user information
    let vrFrameData = new VRFrameData();
    this.vrDisplay.getFrameData(vrFrameData);

    this.renderer.autoClear = false;
    this.scene.matrixAutoUpdate = false;
    this.sceneSkybox.matrixAutoUpdate = false;
    this.camera.matrixAutoUpdate = false;
    this.cameraSkybox.matrixAutoUpdate = false;

    // only draw the first half
    this.partialRender(
      vrFrameData.leftProjectionMatrix,
      vrFrameData.leftViewMatrix,
      0,
      0,
      window.innerWidth * 0.5,
      window.innerHeight
    );

    // clear depth buffer
    this.renderer.clearDepth();

    // only draw the second half
    this.partialRender(
      vrFrameData.rightProjectionMatrix,
      vrFrameData.rightViewMatrix,
      window.innerWidth * 0.5,
      0,
      window.innerWidth * 0.5,
      window.innerHeight
    );

    this.vrDisplay.submitFrame();
  }

  async initVR() {
    if (!navigator.getVRDisplays) {
      throw new Error('Missing important WebVR api.');
    }
    try {
      var displays = await navigator.getVRDisplays();
    } catch(e) {
      throw new Error('Failed to initialize VR display.');
    }

    displays = displays.filter(display => display.capabilities.canPresent);

    // if no devices available, quit.
    if (displays.length == 0) {
      throw new Error('No devices available able to present.');
    }
    // store the first display we find
    this.vrDisplay = displays[0];
    this.vrDisplay.depthNear = NEAR;
    this.vrDisplay.depthFar = FAR;

    await this.vrDisplay.requestPresent([{ source: this.renderer.domElement }]);
  }

  async onEnterFullscreen() {
    let canvas: any = this.renderer.domElement; /* dirty hack */
    try {
      await this.vrDisplay.requestPresent([{ source: this.renderer.domElement }]);
    } catch(e) {
      throw new Error('Failed to initialize VR display.');
    }

    if (canvas.webkitRequestFullscreen) {
      canvas.webkitRequestFullscreen({ vrDisplay: this.vrDisplay, vrDistorion: true });
    } else if (canvas.mozRequestFullScreen) {
      canvas.mozRequestFullScreen({ vrDisplay: this.vrDisplay });
    }
  }

  onFullscreenChange() {
    if (!document.webkitIsFullScreen) {
      this.vrDisplay.exitPresent();
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.cameraSkybox.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.cameraSkybox.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

let app: App = new App();

window.addEventListener('resize', app.onResize.bind(app), false);
window.addEventListener('fullscreenchange', app.onFullscreenChange.bind(app), false);
window.addEventListener('webkitfullscreenchange', app.onFullscreenChange.bind(app), false);
window.addEventListener('mozfullscreenchange', app.onFullscreenChange.bind(app), false);
document.getElementById('btn-fullscreen').onclick = app.onEnterFullscreen.bind(app);

(async () => {
  try {
    if (!navigator.getVRDisplays) {
      throw new Error('Your brower does not support WebVR.');
    } else {
      await app.initVR();
    }
  } catch(e) {
    alert(e + '. A boring version will be loaded instead. :(');
    document.getElementById('btn-fullscreen').remove();
  }
  try {
    app.prepareLight();
    app.prepareEffect();
    await app.prepareTexture();
    await app.prepareGeometry();
    app.prepareSkybox();
    app.render();
  } catch (e) {
    alert(e);
  }
})();