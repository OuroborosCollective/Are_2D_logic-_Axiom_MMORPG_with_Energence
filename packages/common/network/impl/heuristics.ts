import Packet from '../packet';
import Packets from '../packets';

export default class HeuristicsPacket extends Packet {
    public constructor(public H: number[]) {
        super(Packets.Heuristics);
    }

    public override serialize(): [Packets, number[]] {
        return [this.opcode, this.H];
    }
}
