import { Dialog, DialogContent } from "@mui/material";
import CharacteristicForm from "../CharacteristicForm";
import type { OneChar } from "../EditCharacteristicForm";
import type { Node } from "reactflow";
import { createPatient } from "../../api/patients";
import { resolveDefaultRootCharacteristic } from "../../config/defaultCharacteristic";

type Props = {
  open: boolean;
  onClose: () => void;
  parentNode: Node;
  /** True when adding from overview root (e.g. Population / Iran). */
  isOverviewRootClick: boolean;
  allChars: OneChar[];
  onSaved: () => void;
};

export default function AddCharacteristicDialog({
  open,
  onClose,
  parentNode,
  isOverviewRootClick,
  allChars,
  onSaved,
}: Props) {
  const parentSize = parentNode?.data.size;
  const parentId = parentNode?.data.docId || parentNode.id;
  const treeId = parentNode?.data.treeId;

  if (!treeId) {
    console.error("Missing treeId for parent node:", parentNode);
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogContent dividers>
        <CharacteristicForm
          parentId={parentId}
          parentSize={parentSize}
          patientId={treeId}
          onSaved={async ({ characteristicId, rate }) => {
            onClose();

            if (isOverviewRootClick) {
              const charObj = allChars.find((c) => c._id === characteristicId);
              if (!charObj) {
                alert("Characteristic not found");
                return;
              }

              const size = Math.round(parentSize * rate);
              try {
                const rootChar = await resolveDefaultRootCharacteristic();
                await createPatient({
                  node: {
                    node_type: "characteristic",
                    rate: 1.0,
                    size: parentSize,
                    parent_id: null,
                    characteristic_data: {
                      _id: rootChar._id,
                      char_type: rootChar.char_type,
                      name: rootChar.name,
                    },
                    children: [
                      {
                        node_type: "characteristic",
                        rate,
                        size,
                        parent_id: null,
                        characteristic_data: {
                          _id: characteristicId,
                          char_type: charObj.type,
                          name: charObj.name,
                        },
                      },
                    ],
                  },
                });
                alert("Patient created.");
                await onSaved();
              } catch (e) {
                console.error(e);
                alert("Failed to create patient");
              }
            } else {
              await onSaved();
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
