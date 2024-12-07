from pkg.ZODB_manager import RegistryManager
import networkx as nx
import matplotlib.pyplot as plt
from matplotlib.patches import Patch

class GraphVisualizer:
    def __init__(self):
        self.G = nx.Graph()
        # self.primary_indications = set()
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
            self.add_patient_to_graph(patient, population_node)

    def get_primary_indication(self, chars):
        for char, *_ in chars:
            if char.type == 'Primary Indication':
                return char.name
        return None

    def add_patient_to_graph(self, patient, population_node):
        # prev_node_id = None
        chars = patient.chars
        prev_node_id = population_node
        primary_indication = self.get_primary_indication(chars)

        if primary_indication is None:
            return

        for char, size, rate in chars:

            if char.type == 'Primary Indication':
                node_id = char.name

                if not self.G.has_node(node_id):
                    self.G.add_node(node_id, size=size, rate=rate, primary_indication=char.name)
                    self.labels[node_id] = char.name
            
            else:
                node_id = (primary_indication, char.name)
                if not self.G.has_node(node_id):
                    self.G.add_node(node_id, size=size, rate=rate, )
                    self.labels[node_id] = char.name
            self.G.add_edge(prev_node_id, node_id)
            prev_node_id = node_id

    def assign_colors_sizes(self):
        primary_indications = set()
        for _, attr in self.G.nodes(data=True):
            primary_indications.add(attr['primary_indication'])
        primary_indications.discard('Population')

        colors = plt.cm.get_cmap('Set1', len(primary_indications)+1)

        for i, pi in enumerate(sorted(primary_indications)):
            self.color_map[pi] = colors(i)
        self.color_map['Population'] = colors(len(primary_indications))

        sizes = [attr['size'] for _, attr in self.G.nodes(data=True)]
        min_s = min(sizes)
        max_s = max(sizes)
        range = max_s - min_s if max_s != min_s else 1

        for node_id, attr in self.G.nodes(data=True):
            pi = attr['primary_indication']
            if node_id == 'Population':
                norm_size = 1500
            else:
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
