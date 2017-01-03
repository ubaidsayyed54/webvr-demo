import * as THREE from 'three';
import * as _ from 'lodash';

import * as Possion from 'poisson-disk-sampling';
import { Noise } from 'noisejs';

declare function require(string): string;
declare function VRFrameData(): void;

/*
  shadow map not working for some reason
*/

const VRControls: any = require('imports-loader?THREE=three!exports?THREE.VRControls!three/examples/js/controls/VRControls.js');

interface ObjectOf<T> {
  [key: string]: T;
}

const de2ra = function(degree) {
  return degree * (Math.PI/180);
}

/* initialize renderer, scene, camera */

const NEAR = 0.01;
const FAR = 10000;
const FLOOR = -0.1;

const PARTICLE_COUNT = 1000;

class App {

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: THREE.VRControls;

  private lights: ObjectOf<THREE.Light> = {};
  private objects: ObjectOf<THREE.Object3D> = {};
  private objectInstances: ObjectOf<THREE.Object3D[]> = {};
  private textures: ObjectOf<THREE.Texture> = {};

  private particles: THREE.Points | any;
  private particleVelocities: THREE.Vector3[] = [];

  private firstVRFrame:boolean = true;
  private vrDisplay:any; /* new api not in typescript typings yet */

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, NEAR, FAR);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0xffffff, 1);

    this.renderer.gammaInput = true;
    this.renderer.gammaOutput = true;

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    /* controls */
    this.controls = new VRControls(this.camera);

    document.body.appendChild(this.renderer.domElement);
  }

  prepareLight() {
    this.lights['hemisphere'] = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.05);
    this.lights['hemisphere'].position.set(0, 500, 0);
    this.scene.add(this.lights['hemisphere']);

    this.lights['fill'] = new THREE.PointLight(0xffffff, 0.2, 100);
    this.lights['fill'].position.set(0, 0.1, 0);

    this.lights['directional'] = new THREE.DirectionalLight(0xffe6e5, 0.6);
    this.lights['directional'].position.set(20, 10, 2);
    this.lights['directional'].castShadow = true;
    this.lights['directional'].shadow = new THREE.LightShadow(new THREE.PerspectiveCamera(60, 1, 1, 2500));
    this.lights['directional'].shadow.mapSize.width = 1024;
    this.lights['directional'].shadow.mapSize.height = 1024;

    // let helper = new THREE.CameraHelper(this.lights['directional'].shadow.camera);
    // this.scene.add(helper);

    this.scene.add(this.lights['directional']);
  }

  prepareEffect() {
    this.scene.fog = new THREE.FogExp2(0xeef6ff, 0.32);
  }

  async prepareTexture() {
    let loader = new THREE.TextureLoader();

    this.textures['snowflake'] = await loader.load(require('./textures/snowflake.png'));
  }

  async prepareGeometry() {
    let loader = new THREE.JSONLoader();

    let loadPromise = (path: string): Promise<THREE.Object3D> => new Promise((resolve, reject) => {
      loader.load(path, (geometry, materials) => {
        resolve(new THREE.Mesh(geometry, new THREE.MultiMaterial(
          materials.map((material: any): any => {
            if (material.shininess) {
              material.shininess = 0; // no shineness for all object for good looking low-poly
            }
            return material;
          })
        )));
      });
    });

    /* skybox */
    {
      const vertexShader =`
        varying vec3 vWorldPosition;

        void main() {
          vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
      `;

      const fragmentShader = `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;

        varying vec3 vWorldPosition;

        void main() {
          float h = normalize(vWorldPosition).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h , 0.0), exponent), 0.0)), 1.0 );
        }
      `;

      const uniforms = {
        topColor:    { value: new THREE.Color(0x0077ff) },
        bottomColor: { value: new THREE.Color(0xdfeeff) },
        exponent:    { value: 1.0 }
      };

      this.objects['skybox'] = new THREE.Mesh(
        new THREE.SphereGeometry(200, 32, 15),
        new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, side: THREE.BackSide })
      );

      this.scene.add(this.objects['skybox']);
    }

    /* tree */
    {
      let models = [
        await loadPromise(require('file-loader!./models/tree.json')),
        await loadPromise(require('file-loader!./models/tree_2.json')),
        await loadPromise(require('file-loader!./models/tree_3.json')),
        await loadPromise(require('file-loader!./models/rock.json')),
        await loadPromise(require('file-loader!./models/rock_2.json'))
      ];

      const COUNT = 120;

      // use possion disk sampling to distribute trees
      this.objectInstances['objects'] = [];

      let points = new Possion([10, 10], 0.3, 25.0).fill();

      for (let i = 0; i < COUNT; i++) {
        this.objectInstances['objects'][i] = models[i % models.length].clone();

        const x = points[i][0] - 5;
        const y = points[i][1] - 5;

        // if tree is too close, don't render it
        if (x * x + y * y < 0.36) {
          continue;
        }

        this.objectInstances['objects'][i].scale.setScalar(
          Math.random() / 10 + 0.3
        );

        this.objectInstances['objects'][i].rotation.y = Math.random() * 2 * Math.PI;

        this.objectInstances['objects'][i].rotation.x = Math.random() * 0.05 * Math.PI;
        this.objectInstances['objects'][i].rotation.z = Math.random() * 0.05 * Math.PI;

        this.objectInstances['objects'][i].position.set(
          x,
          FLOOR,
          y
        );

        this.objectInstances['objects'][i].castShadow = true;
        this.scene.add(this.objectInstances['objects'][i]);
      }
    }

    /* ground */
    {
      const SEGMENT_COUNT = 200;

      let geometry = new THREE.PlaneGeometry(20, 20, SEGMENT_COUNT - 1, SEGMENT_COUNT - 1);
      let noiseGenerator = new Noise(Math.random());

      for (let i = 0, l = geometry.vertices.length; i < l; i++) {
        let vertex = geometry.vertices[i];
        let data = noiseGenerator.perlin2(vertex.x, vertex.y);
        vertex.z = Math.abs(data * 0.2) - 0.05;
      }

      geometry.computeFaceNormals();
      geometry.computeVertexNormals();

      this.objects['ground'] = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: 0xdddddd,
          emissive: new THREE.Color(0xffffff),
          emissiveIntensity: 0.5
        })
      );

      this.objects['ground'].rotation.x = de2ra(-90);
      this.objects['ground'].position.set(0, FLOOR, 0);
      this.objects['ground'].receiveShadow = true;
      this.scene.add(this.objects['ground']);
    }

    /* fox */
    {
      this.objects['fox'] = await loadPromise(require('file-loader!./models/fox.json'));
      this.objects['fox'].scale.setScalar(0.05);
      this.objects['fox'].position.set(-0.4, FLOOR, -0.4);
      this.objects['fox'].rotation.y = Math.PI / 8.0;
      this.objects['fox'].castShadow = true;
      this.scene.add(this.objects['fox']);
    }

    /* snow */
    {
      let geometry = new THREE.Geometry();
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        this.particleVelocities[i] = new THREE.Vector3(
          Math.random() * 0.005,
          -Math.random() * 0.01,
          Math.random() * 0.005
        );
        let particle = new THREE.Vector3(
          Math.random() * 20 - 10,
          Math.random() * 20 - 10,
          Math.random() * 20 - 10
        );
        geometry.vertices.push(particle);
      }

      let materials = new THREE.PointsMaterial({
        map: this.textures['snowflake'],
        blending: THREE.AdditiveBlending,
        size: 0.2,
        depthTest: false,
        transparent: true
      });

      this.particles = new THREE.Points(geometry, materials);
      this.scene.add(this.particles);
    }
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
      this.scene.matrix.fromArray(viewMatrix);
      this.scene.updateMatrixWorld(true);
    }
    this.renderer.setViewport(x, y, width, height);
    this.renderer.render(this.scene, this.camera);
  }

  update() {
    /* update particles */
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.particles.geometry.vertices[i].add(this.particleVelocities[i]);
      if (Math.abs(this.particles.geometry.vertices[i].y - FLOOR) < -0.1) {
        this.particles.geometry.vertices[i].y = 10;
      }
    }
    this.particles.rotation.y += 0.001;
    this.particles.geometry.verticesNeedUpdate = true;

    this.objects['skybox'].position.copy(this.camera.position);
  }

  render() {
    this.update();
    this.renderer.clear();

    if (!this.vrDisplay || this.vrDisplay.isPresenting == false) { // if not in VR mode, only render the left halve
      requestAnimationFrame(this.render.bind(this));
      this.controls.update();
      this.renderer.autoClear = false;
      this.scene.matrixAutoUpdate = true;
      this.camera.matrixAutoUpdate = true;
      this.partialRender(
        null,
        null,
        0,
        0,
        window.innerWidth,
        window.innerHeight
      );
      return;
    }

    this.vrDisplay.requestAnimationFrame(this.render.bind(this));
    this.controls.update();

    // get the vr user information
    let vrFrameData = new VRFrameData();
    this.vrDisplay.getFrameData(vrFrameData);

    this.renderer.autoClear = false;
    this.scene.matrixAutoUpdate = false;
    this.camera.matrixAutoUpdate = false;

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

    //await this.vrDisplay.requestPresent([{ source: this.renderer.domElement }]);
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
    this.camera.updateProjectionMatrix();
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
    app.render();
  } catch (e) {
    alert(e);
  }
})();