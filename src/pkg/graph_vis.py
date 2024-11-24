from pkg.ZODB_manager import RegistryManager
import networkx as nx
import matplotlib.pyplot as plt
from matplotlib.patches import Patch

class GraphVisualizer:
    def __init__(self):
        self.G = nx.Graph()
        self.primary_indications = set()
        self.color_map = {}
        self.labels = {}
        self.node_colors = []
        self.node_sizes = []
        self.pos = {}
    
    def load_data(self):
        with RegistryManager() as rm:
            patient_registry = rm.get_registry('patient_registry')
            self.build_graph(patient_registry)

    def build_graph(self, patient_registry):
        population_node = 'Population'
        self.G.add_node(population_node, size=1, primary_indication='Population')
        self.labels[population_node] = 'Population'

        for patient in patient_registry.values():
            chars = patient.chars
            primary_indication = self.get_primary_indication(chars)
            if primary_indication is None:
                continue
            self.primary_indications.add(primary_indication)
            self.add_patient_to_graph(patient, primary_indication, population_node)

    def get_primary_indication(self, chars):
        for char, *_ in chars:
            if char.type == 'Primary Indication':
                return char.name
        return None

    def add_patient_to_graph(self, patient, primary_indication, population_node):
        prev_node_id = None
        chars = patient.chars
        primary_indication_node = primary_indication
        if not self.G.has_node(primary_indication_node):
            self.G.add_node(primary_indication_node, size=1, primary_indication=primary_indication)
            self.labels[primary_indication_node] = primary_indication
            self.G.add_edge(population_node, primary_indication_node)

        prev_node_id = primary_indication_node

        for i, (char, size, rate) in enumerate(chars):

            if char.type == 'Population':
                continue
                
            node_id = (primary_indication, char.name)
            self.G.add_node(node_id, size=size, rate=rate, primary_indication=primary_indication)
            self.labels[node_id] = char.name

            if prev_node_id is not None:
                self.G.add_edge(prev_node_id, node_id)
            prev_node_id = node_id

    def assign_colors_sizes(self):
        primary_indications = list(self.primary_indications) + ['Population']
        colors = plt.cm.get_cmap('Set1', len(primary_indications))

        for i, pi in enumerate(primary_indications):
            self.color_map[pi] = colors(i)
        
        sizes = [attr['size'] for _, attr in self.G.nodes(data=True)]
        min_s = min(sizes)
        max_s = max(sizes)
        range = max_s - min_s if max_s != min_s else 1

        for _, attr in self.G.nodes(data=True):
            pi = attr['primary_indication']
            self.node_colors.append(self.color_map[pi])
            norm_size = ((attr['size'] - min_s) / range) * 600 + 200
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
        
        legend_handles = [
            Patch(color=self.color_map[pi], label=pi) for pi in self.primary_indications
            ]
        legend_handles.append(
            Patch(color=self.color_map['Population'], label='Population')
            )
        plt.legend(handles=legend_handles, title='Primary Indication')

        plt.axis('off')
        plt.title('Patient Characteristics Graph')
        plt.show()

    def visualize(self):
        self.assign_colors_sizes()
        self.set_positions()
        self.draw_graph()
        
def main():
    vis = GraphVisualizer()
    vis.load_data()
    vis.visualize()

if __name__ == '__main__':
    main()
