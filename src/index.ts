import 'webvr-polyfill/src/main';
import * as THREE from 'three';

declare function require(string): string;
declare function VRFrameData(): void;

/* initialize renderer, scene, camera */

const NEAR = 0.1;
const FAR = 1000;

interface ObjectOf<T> {
  [key: string]: T;
}

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
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, NEAR, FAR);
    this.cameraSkybox = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, NEAR, FAR);
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0xffffff, 1);

    document.body.appendChild(this.renderer.domElement);
  }

  prepareLight() {
    this.lights['ambient'] = new THREE.AmbientLight(0xffffff, 0.5);
    this.lights['directional'] = new THREE.DirectionalLight(0xffffff, 1);
    this.lights['directional'].position.set(10, 20, 20);
    this.scene.add(this.lights['ambient']);
    this.scene.add(this.lights['directional']);
  }

  async prepareTexture() {
    /* skybox texture */
    let cubeLoader = new THREE.CubeTextureLoader();
    this.textures['skybox'] = await cubeLoader.load([
      require('./textures/skybox/craterlake_rt.jpg'),
      require('./textures/skybox/craterlake_lf.jpg'),
      require('./textures/skybox/craterlake_up.jpg'),
      require('./textures/skybox/craterlake_dn.jpg'),
      require('./textures/skybox/craterlake_bk.jpg'),
      require('./textures/skybox/craterlake_ft.jpg')
    ]);
    this.textures['skybox'].format = THREE.RGBFormat;
    /* geometry texture */
    let loader = new THREE.TextureLoader();
    this.textures['earth'] = await loader.load(require('./textures/earth.jpg'));
    this.textures['earthNormal'] = await loader.load(require('./textures/earth_normal.jpg'));
  }

  prepareGeometry() {
    let loader = new THREE.TextureLoader();
    this.objects['earth'] = new THREE.Mesh(
      new THREE.SphereGeometry(2, 256, 256, 256),
      new THREE.MeshPhongMaterial({
        //map: this.textures['earth'],
        envMap: this.textures['skybox'],
        //normalMap: this.textures['earthNormal'],
        shininess: 100
      })
    );
    this.objects['earth'].position.z = -5;
    this.scene.add(this.objects['earth']);
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
    this.camera.projectionMatrix.fromArray(projectionMatrix);
    this.cameraSkybox.projectionMatrix.fromArray(projectionMatrix);
    this.scene.matrix.fromArray(viewMatrix);
    this.scene.updateMatrixWorld(true);
    this.sceneSkybox.matrix.fromArray(viewMatrix);
    this.sceneSkybox.updateMatrixWorld(true);

    this.renderer.setViewport(x, y, width, height);
    this.renderer.render(this.sceneSkybox, this.cameraSkybox);

    this.renderer.setViewport(x, y, height, height);
    this.renderer.render(this.scene, this.camera);
  }

  update() {
    this.objects['earth'].rotation.y += 0.01;
  }

  render() {
    if (this.firstVRFrame) {
      this.firstVRFrame = false;
      return this.vrDisplay.requestAnimationFrame(this.render.bind(this));
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
    this.renderer.clear();

    this.update();

    // if not in VR mode, only render the left halve
    if (this.vrDisplay.isPresenting == false) {
      this.partialRender(
        vrFrameData.leftProjectionMatrix,
        vrFrameData.leftViewMatrix,
        0,
        0,
        window.innerWidth,
        window.innerHeight
      );
      return;
    }

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

  initVR() {
    if (!navigator.getVRDisplays) {
      throw new Error('Your brower does not support WebVR :(');
    }

    navigator.getVRDisplays().then(displays => {
      // Filter down to devices that can present
      displays = displays.filter(display => display.capabilities.canPresent);

      // if no devices available, quit.
      if (displays.length == 0) {
        throw new Error('No devices available able to present.');
      }

      // store the first display we find
      this.vrDisplay = displays[0];
      this.vrDisplay.depthNear = NEAR;
      this.vrDisplay.depthFar = FAR;
    });
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
    app.initVR();
    app.prepareLight();
    await app.prepareTexture();
    app.prepareGeometry();
    app.prepareSkybox();
    app.render();
  } catch (e) {
    alert(e);
  }
})();