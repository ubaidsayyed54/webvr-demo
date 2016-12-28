import * as Three from 'three';

declare function require(string): string;
declare function VRFrameData(): void;

/* initialize renderer, scene, camera */

const NEAR = 0.1;
const FAR = 10000;

let scene = new Three.Scene();
let camera = new Three.PerspectiveCamera(45, window.innerWidth / window.innerHeight, NEAR, FAR);
let renderer = new Three.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xffffff, 1);
document.body.appendChild(renderer.domElement);

/* prepare light */

let ambientLight = new Three.AmbientLight(0xffffff, 0.5);
let light = new Three.DirectionalLight(0xffffff, 1);
light.position.set(10, 20, 20);
scene.add(ambientLight);
scene.add(light);

/* prepare geometry */

let loader = new Three.TextureLoader();

let torus:Three.Object3D;
loader.load(require('./textures/earth.jpg'), map => {
  loader.load(require('./textures/earth_normal.jpg'), normalMap => {
    let geometry = new Three.SphereGeometry(2, 256, 256, 256);
    let material = new Three.MeshPhongMaterial({
      map,
      normalMap,
      shininess: 0
    });
    torus = new Three.Mesh(geometry, material);
    torus.position.z = -10;
    scene.add(torus);
  });
});

/* initialize everything else */

this.firstVRFrame = true;

let render = () => {
  // for first frame, use the standard api
  if (this.firstVRFrame) {
    this.firstVRFrame = false;
    return this.vrDisplay.requestAnimationFrame(render);
  }

  // get the vr user information
  let vrFrameData = new VRFrameData();
  this.vrDisplay.getFrameData(vrFrameData);

  renderer.autoClear = false;
  scene.matrixAutoUpdate = false;
  camera.matrixAutoUpdate = false;
  renderer.clear();

  if (torus) {
    torus.rotation.y += 0.01;
  }

  // only draw the first half
  renderer.setViewport(0, 0, window.innerWidth * 0.5, window.innerHeight);
  const lProjectionMatrix = vrFrameData.leftProjectionMatrix;
  const lViewMatrix = vrFrameData.leftViewMatrix;
  camera.projectionMatrix.fromArray(lProjectionMatrix);
  scene.matrix.fromArray(lViewMatrix);
  scene.updateMatrixWorld(true);
  renderer.render(scene, camera);

  // clear depth buffer
  renderer.clearDepth();

  // only draw the second half
  renderer.setViewport(window.innerWidth * 0.5, 0, window.innerWidth * 0.5, window.innerHeight);
  const rProjectionMatrix = vrFrameData.rightProjectionMatrix;
  const rViewMatrix = vrFrameData.rightViewMatrix;
  camera.projectionMatrix.fromArray(rProjectionMatrix);
  scene.matrix.fromArray(rViewMatrix);
  scene.updateMatrixWorld(true);
  renderer.render(scene, camera);
  this.vrDisplay.requestAnimationFrame(render);
  this.vrDisplay.submitFrame();
};

if (!navigator.getVRDisplays) {
  alert('Your brower does not support WebVR :(');
} else {
  navigator.getVRDisplays().then(displays => {
    // Filter down to devices that can present
    displays = displays.filter(display => display.capabilities.canPresent);

    // if no devices available, quit.
    if (displays.length == 0) {
      alert('No devices available able to present.');
      return;
    }

    // store the first display we find
    this.vrDisplay = displays[0];
    this.vrDisplay.depthNear = NEAR;
    this.vrDisplay.depthFar = FAR;

    this.vrDisplay.requestPresent([{ source: renderer.domElement }])
      .then(() => {
        console.log('VR display initialized. Start rendering ...');
        render();
      })
      .catch(e => alert('Failed to initialize VR display.' + e.printStack()));
  });
}