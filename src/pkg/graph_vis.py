import networkx as nx
from networkx.drawing.nx_agraph import graphviz_layout
import matplotlib.pyplot as plt
from matplotlib.patches import Patch
from collections import deque
from pkg.ZODB_manager import RegistryManager

class GraphVisualizer:
    def __init__(self):
        self.G = nx.DiGraph()
        self.labels = {}
        self.node_map = {}
        # self.primary_indications = set()
        self.node_colors = []
        self.node_sizes = []
        self.pos = {}
        self.pi_nodes = []
        self.patient_data = {}
    
    def load_data(self):
        with RegistryManager() as rm:
            patient_registry = rm.get_registry('patient_registry')
            self.build_graph(patient_registry)

    def build_graph(self, patient_registry):
        for patient in patient_registry.values():
            self.add_patient(patient)

    def get_primary_indication(self, chars):
        for char, *_ in chars:
            if char.type == 'Primary Indication':
                return char.name
        return None

    def add_patient(self, patient):
        # prev_node_id = None
        chars = patient.chars
        prev_node_id = None

        for char, size, rate in chars:
            node_key = (char.type, char.name, size, rate)
            if node_key not in self.node_map:
                node_id = node_key
                self.node_map[node_key] = node_id
                self.G.add_node(
                    node_id, 
                    type=char.type,
                    name=char.name,
                    size=size,
                    rate=rate
                    )
                self.labels[node_id] = char.name
                if char.type == 'Primary Indication':
                    self.pi_nodes.append(node_id)
            else:
                node_id = self.node_map[node_key]
            if prev_node_id is not None:
                self.G.add_edge(prev_node_id, node_id)
            prev_node_id = node_id

        self.patient_data[patient._get_hash()] = patient
    
    def get_patient_data(self, patient_id):
        return self.patient_data.get(patient_id, None)

    def color_branches(self):
        branch_count = len(self.pi_nodes)
        cmap = plt.cm.get_cmap('Set1', branch_count)
        visited = set()
        for i, pi_node in enumerate(self.pi_nodes):
            branch_color = cmap(i)
            queue = deque([pi_node])
            while queue:
                current= queue.popleft()
                if current in visited:
                    continue
                visited.add(current)
                self.G.nodes[current]['branch_color'] = branch_color
                for nbr in self.G.successors(current):
                    if nbr not in visited:
                        queue.append(nbr)

    def assign_colors_sizes(self):
        sizes = [attr['size'] for _,attr in self.G.nodes(data=True)]
        min_size = min(sizes) if sizes else 1
        max_size = max(sizes) if sizes else 1
        size_range = max_size - min_size if max_size != min_size else 1

        for node_id, attr in self.G.nodes(data=True):
            branch_color = attr.get('branch_color', 'green')
            self.node_colors.append(branch_color)
            norm_size = ((attr['size'] - min_size) / size_range) * (800 - 200) + 200
            self.node_sizes.append(norm_size)

    def set_positions(self):
        self.pos = graphviz_layout(self.G, prog='dot', args='-Grankdir=TB')
        population_node = None
        # for node_id, attr in self.G.nodes(data=True):
        #     if attr['type'] == 'Population':
        #         population_node = node_id
        #         break
        # if population_node and population_node in self.pos:
        #     self.pos[population_node] = (0, 0)

    def draw_graph(self):
        plt.figure(figsize=(12, 8))
        nx.draw_networkx_nodes(
            self.G,
            self.pos,
            node_color= self.node_colors,
            node_size=self.node_sizes
            )
        nx.draw_networkx_edges(
            self.G,
            self.pos,
            edge_color='black',
            width=2.0,
            alpha=0.7
            )
        nx.draw_networkx_labels(
            self.G,
            self.pos,
            self.labels,
            font_size=8
            )
        
        branch_colors = {}
        for pi_node in self.pi_nodes:
            c = self.G.nodes[pi_node].get('branch_color')
            if c not in branch_colors:
                branch_colors[pi_node] = c

        legend_handles = [
            Patch(color=c, label=f"{pi_node[1]}") for pi_node, c in branch_colors.items()
            ]
        plt.legend(handles=legend_handles, title='Population branches')

        plt.axis('off')
        plt.title('Patient Characteristics Graph')
        plt.show()

    def visualize(self):
        self.color_branches()
        self.assign_colors_sizes()
        self.set_positions()
        self.draw_graph()

    def filter_graph_by_patient(self, patient_id):
        patient = self.get_patient_data(patient_id)
        if patient:
            # Filter the graph and display only the patient nodes and edges connected to the patient
            patient_node_ids = self._get_patient_nodes(patient)
            
            # Remove non-matching nodes and edges
            nodes_to_keep = set(patient_node_ids)
            self.G = self.G.subgraph(nodes_to_keep).copy()  # Keep only the relevant nodes and edges
            
            # Now we can redraw the graph with only the relevant patient data
            self.color_branches()  # Reapply coloring
            self.assign_colors_sizes()  # Recalculate sizes
            self.set_positions()  # Adjust positions
            self.draw_graph()  # Redraw the graph

    def _get_patient_nodes(self, patient):
        # This method gets the nodes connected to the patient
        nodes = []
        for char, _, _ in patient.chars:
            for node_key, node_id in self.node_map.items():
                if char.name == node_key[1]:
                    nodes.append(node_id)
        return nodes
def main():
    vis = GraphVisualizer()
    vis.load_data()
    vis.visualize()

if __name__ == '__main__':
    main()
