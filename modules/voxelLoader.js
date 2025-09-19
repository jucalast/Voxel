import * as THREE from 'three';

const uploadedModels = []; // Stores { filename: string, mesh: THREE.InstancedMesh }

export function initVoxelScene(scene, initialVoxelData) {
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    if (initialVoxelData && initialVoxelData.length > 0) {
        const initialMesh = new THREE.InstancedMesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshLambertMaterial(),
            initialVoxelData.length
        );

        initialVoxelData.forEach((voxel, i) => {
            matrix.setPosition(voxel.x, voxel.y, voxel.z);
            initialMesh.setMatrixAt(i, matrix);
            initialMesh.setColorAt(i, color.set(voxel.color));
        });
        scene.add(initialMesh);
        uploadedModels.push({ filename: 'initial_model', mesh: initialMesh }); // Store initial model
    }
}

export function addVoxelModel(scene, newVoxelData, filename) {
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    if (newVoxelData && newVoxelData.length > 0) {
        const newInstancedMesh = new THREE.InstancedMesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshLambertMaterial(),
            newVoxelData.length
        );

        newVoxelData.forEach((voxel, i) => {
            matrix.setPosition(voxel.x, voxel.y, voxel.z);
            newInstancedMesh.setMatrixAt(i, matrix);
            newInstancedMesh.setColorAt(i, color.set(voxel.color));
        });

        scene.add(newInstancedMesh);
        uploadedModels.push({ filename: filename, mesh: newInstancedMesh });
        console.log(`Added ${filename} to scene.`);
    } else {
        console.warn(`No voxel data provided for ${filename}.`);
    }
}

export function removeVoxelModel(scene, filename) {
    const index = uploadedModels.findIndex(model => model.filename === filename);
    if (index !== -1) {
        const modelToRemove = uploadedModels[index];
        scene.remove(modelToRemove.mesh);
        uploadedModels.splice(index, 1);
        console.log(`Removed ${filename} from scene.`);
    }
}

// Function to get all currently loaded models (useful for debugging or further manipulation)
export function getLoadedModels() {
    return uploadedModels;
}