const fs = require("fs");
const path = require("path");
const occtimportjs = require("occt-import-js");
const { Document, NodeIO } = require("@gltf-transform/core");

const input = process.argv[2] || "/Users/krish/Downloads/Rocky - ARC AeroTech (1).step";
const output = process.argv[3] || path.join(__dirname, "../public/rocky.glb");

async function main() {
  const occt = await occtimportjs();
  const fileContent = fs.readFileSync(input);
  const result = occt.ReadStepFile(fileContent, {
    linearUnit: "millimeter",
    linearDeflectionType: "bounding_box_ratio",
    linearDeflection: 0.0008,
    angularDeflection: 0.2,
  });

  if (!result.success) {
    throw new Error("STEP import failed");
  }

  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene("Rocky");
  doc.getRoot().setDefaultScene(scene);

  for (const meshData of result.meshes) {
    const position = new Float32Array(meshData.attributes.position.array);
    const index = new Uint32Array(meshData.index.array);
    const normalSource = meshData.attributes.normal?.array;
    const normal = normalSource
      ? new Float32Array(normalSource)
      : computeNormals(position, index);

    const positionAccessor = doc
      .createAccessor()
      .setType("VEC3")
      .setArray(position)
      .setBuffer(buffer);
    const normalAccessor = doc
      .createAccessor()
      .setType("VEC3")
      .setArray(normal)
      .setBuffer(buffer);
    const indexAccessor = doc
      .createAccessor()
      .setType("SCALAR")
      .setArray(index)
      .setBuffer(buffer);

    const primitive = doc
      .createPrimitive()
      .setAttribute("POSITION", positionAccessor)
      .setAttribute("NORMAL", normalAccessor)
      .setIndices(indexAccessor);
    const mesh = doc.createMesh(meshData.name).addPrimitive(primitive);
    scene.addChild(doc.createNode(meshData.name).setMesh(mesh));
  }

  const io = new NodeIO();
  await io.write(output, doc);
  const bytes = fs.statSync(output).size;
  console.log(`Wrote ${result.meshes.length} meshes to ${output} (${bytes} bytes)`);
}

function computeNormals(position, index) {
  const normal = new Float32Array(position.length);
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i] * 3;
    const b = index[i + 1] * 3;
    const c = index[i + 2] * 3;
    const abx = position[b] - position[a];
    const aby = position[b + 1] - position[a + 1];
    const abz = position[b + 2] - position[a + 2];
    const acx = position[c] - position[a];
    const acy = position[c + 1] - position[a + 1];
    const acz = position[c + 2] - position[a + 2];
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    for (const vertex of [a, b, c]) {
      normal[vertex] += nx;
      normal[vertex + 1] += ny;
      normal[vertex + 2] += nz;
    }
  }
  for (let i = 0; i < normal.length; i += 3) {
    const length = Math.hypot(normal[i], normal[i + 1], normal[i + 2]) || 1;
    normal[i] /= length;
    normal[i + 1] /= length;
    normal[i + 2] /= length;
  }
  return normal;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
