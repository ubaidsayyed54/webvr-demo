import * as Three from 'three';

/* initialize renderer, scene, camera */

let scene = new Three.Scene();
let camera = new Three.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 100);
let renderer = new Three.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xffffff, 1);
document.body.appendChild(renderer.domElement);

/* prepare light */

let ambientLight = new Three.AmbientLight(0xffffff, 0.05);
let light = new Three.DirectionalLight(0xffffff, 1);
light.position.set(10, 20, 20);
scene.add(ambientLight);
scene.add(light);

/* prepare geometry */

let geometry = new Three.TorusGeometry(2, 1, 64, 100);
let material = new Three.MeshPhongMaterial({
  color: 0x555500,
  specular: 0xffffff,
  shininess: 2
});

let donut = new Three.Mesh(geometry, material);
donut.scale.set(0.5, 0.5, 0.5);
scene.add(donut);

/* initialize everything else */

camera.position.z = 5;

let render = () => {
  requestAnimationFrame(render);
  donut.rotation.x += 0.01;
  renderer.render(scene, camera);
};

render();