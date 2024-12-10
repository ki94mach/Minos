from ZODB_manager import RegistryManager
import networkx as nx
import matplotlib.pyplot as plt
from matplotlib.patches import Patch
from collections import deque

class GraphVisualizer:
    def __init__(self):
        self.G = nx.Graph()
        self.labels = {}
        self.node_map = {}
        # self.primary_indications = set()
        self.node_colors = []
        self.node_sizes = []
        self.pos = {}
        self.branch = {}
        self.population_branches = []
    
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
            else:
                node_id = self.node_map[node_key]
            if prev_node_id is not None:
                self.G.add_edge(prev_node_id, node_id)
            prev_node_id = node_id

    def identify_branch(self):
        for node_id, attr in self.G.nodes(data=True):
            if attr['type'] == 'Population':
                self.population_branches.append(node_id)
    
    def color_branch(self):
        branch_count = len(self.population_branches)
        cmap = plt.cm.get_cmap('Set1', branch_count)
        visited = set()
        for i, pop_node in enumerate(self.population_branches):
            branch_color = cmap(i)
            queue = deque([pop_node])
            while queue:
                current = queue.popleft()
                if current in visited:
                    continue
                visited.add(current)
                self.G.nodes[current]['branch_color'] = branch_color
                for nbr in self.G.neighbors(current):
                    if nbr not in visited:
                        queue.append(nbr)

    def assign_colors_sizes(self):
        sizes = [attr['size'] for _,attr in self.G.nodes(data=True)]
        min_size = min(sizes) if sizes else 1
        max_size = max(sizes) if sizes else 1
        size_range = max_size - min_size if max_size != min_size else 1

        for node_id, attr in self.G.nodes(data=True):
            branch_color = attr.get('branch_color', 'grey')
            self.node_colors.append(branch_color)
            norm_size = ((attr['size'] - min_size) / size_range) * (800 - 200) + 200
            self.node_sizes.append(norm_size)

    def set_positions(self):
        self.pos = nx.spring_layout(self.G, k=0.5, seed=42)
        if 'Population' in self.pos:
            self.pos['Population'] = [0, 0]

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
        
        branch_colors = []
        for pop_node in self.population_branches:
            c = self.G.nodes[pop_node]['branch_color']
            if c not in branch_colors:
                branch_colors.append(c)

        legend_handles = [
            Patch(color=c, label=f"Branch {i+1}") for i, c in enumerate(branch_colors)
            ]
        plt.legend(handles=legend_handles, title='Population branches')

        plt.axis('off')
        plt.title('Patient Characteristics Graph')
        plt.show()

    def visualize(self):
        self.identify_branch()
        self.color_branch()
        self.assign_colors_sizes()
        self.set_positions()
        self.draw_graph()
        
def main():
    vis = GraphVisualizer()
    vis.load_data()
    vis.visualize()

if __name__ == '__main__':
    main()
