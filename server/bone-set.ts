
import assert from 'node:assert';
import Bone from './core/bone';

export default class BoneSet {

    /**
     * A map is better, but we want to keep the bones in order
     */

    private bones: Bone[] = [];

    constructor(bones: Bone[] = []) {
        this.set(bones);
    }

    get size(): number {
        return this.bones.length;
    }

    ids(): string[] {
        return this.bones.map(({id}) => id);
    }

    values(): Bone[] {
        return [...this.bones];
    }

    clear(): void {
        this.bones = [];
    }

    set(bones: Bone[]) {
        this.bones = [...bones];
    }

    index(id: string): number {
        const result = this.bones.findIndex((bone) => bone.id === id);
        assert(result >= 0, `Bone ${id} not in set`);
        return result;
    }

    delete(id: string): Bone {
        const index = this.index(id);
        const bone = this.bones[index];
        this.bones.splice(index, 1);
        return bone;
    }

    has(id: string): Bone | undefined {
        return this.bones.find((bone) => bone.id === id);
    }

    get(id: string): Bone {
        return this.bones[this.index(id)];
    }
}
