import * as Three from 'three';

declare function require(string): string;

/* initialize renderer, scene, camera */

let scene = new Three.Scene();
let camera = new Three.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 100);
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
    scene.add(torus);
  });
});

/* initialize everything else */

camera.position.z = 5;

let render = () => {
  if (torus) {
    torus.rotation.y += 0.01;
  }
  requestAnimationFrame(render);
  renderer.render(scene, camera);
};

render();