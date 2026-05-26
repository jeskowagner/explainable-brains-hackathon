"""Vibraint hackathon — embedding explorer.

Run with:
    streamlit run app.py

Left:  2-D projection (PCA or UMAP) of the PLIP embeddings. Hover for metadata,
       click a point to select.
Right: the selected patch + its quality metrics.

Sidebar:  projection toggle (PCA / UMAP) and color-by selector (condition,
          brain, or any per-patch quality metric).
"""

import numpy as np
import plotly.graph_objects as go
import plotly.express as px
import streamlit as st

from data import compute_pca, compute_umap, load_embeddings, load_patch, patch_to_uint8

st.set_page_config(page_title="Explainable Brains — Embedding explorer", layout="wide")


CATEGORICAL = {
    "condition":     {"Control": "#3b82f6", "Semaglutide": "#ef4444"},
    "brain_idx":     None,   # filled at runtime from a qualitative palette
}

CONTINUOUS = [
    "sharpness", "snr", "local_contrast", "foreground_fraction",
    "mean_intensity", "std_intensity", "fraction_signal",
]


@st.cache_data
def _load():
    emb, meta = load_embeddings()
    pca_coords, pca_var = compute_pca(n_components=2)
    umap_coords = compute_umap()
    return emb, meta, pca_coords, pca_var, umap_coords


emb, meta, pca_coords, pca_var, umap_coords = _load()

# ---------- Sidebar controls ----------
with st.sidebar:
    st.header("View")
    view_mode = st.radio("Mode", ["Embedding (2-D)", "Brain anatomy (3-D)"])

    if view_mode == "Embedding (2-D)":
        projection = st.radio("Projection", ["PCA", "UMAP"], horizontal=True)
        brain_filter = None
    else:
        projection = None
        brain_filter = st.multiselect(
            "Brains",
            sorted(meta["brain_idx"].unique()),
            default=[meta["brain_idx"].iloc[0]],
            format_func=lambda b: f"#{b} · {meta[meta['brain_idx']==b]['condition'].iloc[0][:4]} · {meta[meta['brain_idx']==b]['animal_nr'].iloc[0]}",
        )

    color_by = st.selectbox(
        "Color by",
        list(CATEGORICAL.keys()) + CONTINUOUS,
        index=0,
    )
    st.markdown("---")
    st.caption(
        f"**{len(meta):,} patches** · 12 brains  \n"
        f"6 Control / 6 Semaglutide  \n"
        f"PLIP 512-d → 2-D"
    )

# ---------- Pick projection ----------
if view_mode == "Embedding (2-D)":
    if projection == "PCA":
        coords = pca_coords
        x_label = f"PC1 ({pca_var[0]*100:.1f}%)"
        y_label = f"PC2 ({pca_var[1]*100:.1f}%)"
        subtitle = f"PCA · {pca_var.sum()*100:.1f}% explained"
    else:
        coords = umap_coords
        x_label = "UMAP-1"
        y_label = "UMAP-2"
        subtitle = "UMAP · cosine, n_neighbors=15, min_dist=0.1"
    visible_idx = np.arange(len(meta))
else:
    coords = None  # 3-D path builds its own scatter
    x_label, y_label = "x0 (vox)", "y0 (vox)"
    if brain_filter:
        visible_idx = np.where(meta["brain_idx"].isin(brain_filter).values)[0]
        subtitle = f"Brain anatomy · 5 µm voxels · {len(brain_filter)} brain(s) · {len(visible_idx)} patches"
    else:
        visible_idx = np.array([], dtype=int)
        subtitle = "Brain anatomy · pick one or more brains in the sidebar"

st.title("Explainable Brains — embedding explorer")
st.caption(subtitle)

# ---------- Build figure ----------
left, right = st.columns([3, 2], gap="large")


def _customdata(idx_array):
    return np.column_stack([
        idx_array,
        meta["scan_name"].values[idx_array],
        meta["brain_idx"].values[idx_array],
        meta["sharpness"].values[idx_array],
        meta["snr"].values[idx_array],
        meta["foreground_fraction"].values[idx_array],
    ])


HOVER = (
    "<b>%{customdata[1]}</b><br>"
    "brain #%{customdata[2]} · global idx %{customdata[0]}<br>"
    "sharpness %{customdata[3]:.1f} · snr %{customdata[4]:.2f} · fg %{customdata[5]:.2f}"
    "<extra></extra>"
)


def _build_figure():
    is_3d = view_mode != "Embedding (2-D)"

    def _scatter_kwargs(idx):
        """Coords for the chosen view mode for the given row indices."""
        if is_3d:
            return dict(
                x=meta["x0"].values[idx],
                y=meta["y0"].values[idx],
                z=meta["z_mid_absolute"].values[idx],
            )
        return dict(x=coords[idx, 0], y=coords[idx, 1])

    Scatter = go.Scatter3d if is_3d else go.Scattergl
    marker_size = 3 if is_3d else 4

    fig = go.Figure()
    if color_by in CATEGORICAL:
        if color_by == "condition":
            cats_colors = list(CATEGORICAL["condition"].items())
        else:  # brain_idx
            palette = px.colors.qualitative.Light24
            cats = sorted(meta["brain_idx"].unique())
            cats_colors = [(c, palette[i % len(palette)]) for i, c in enumerate(cats)]

        for cat, col in cats_colors:
            mask = (meta[color_by].values == cat)
            idx = np.where(mask)[0]
            idx = np.intersect1d(idx, visible_idx, assume_unique=True)
            if len(idx) == 0:
                continue
            fig.add_trace(Scatter(
                **_scatter_kwargs(idx),
                mode="markers",
                marker=dict(size=marker_size, color=col, opacity=0.7 if is_3d else 0.55),
                name=str(cat),
                customdata=_customdata(idx),
                hovertemplate=HOVER,
            ))
    else:
        idx = visible_idx
        if len(idx) > 0:
            vals = meta[color_by].values[idx].astype(float)
            cmin, cmax = np.percentile(vals, [1, 99])
            fig.add_trace(Scatter(
                **_scatter_kwargs(idx),
                mode="markers",
                marker=dict(
                    size=marker_size, color=vals, opacity=0.85 if is_3d else 0.7,
                    colorscale="Viridis", cmin=cmin, cmax=cmax,
                    showscale=True,
                    colorbar=dict(title=color_by, len=0.6, thickness=12),
                ),
                customdata=_customdata(idx),
                hovertemplate=HOVER,
                showlegend=False,
            ))

    if is_3d:
        fig.update_layout(
            scene=dict(
                xaxis_title="x0 (vox)",
                yaxis_title="y0 (vox)",
                zaxis_title="z_mid (vox)",
                aspectmode="data",
                zaxis=dict(autorange="reversed"),  # anatomical convention: z increases ventrally
            ),
            height=680, margin=dict(l=0, r=0, t=10, b=0),
            legend=dict(orientation="h", yanchor="bottom", y=1.0, x=0),
        )
    else:
        fig.update_layout(
            xaxis_title=x_label, yaxis_title=y_label,
            height=640, margin=dict(l=0, r=0, t=10, b=0),
            legend=dict(orientation="h", yanchor="bottom", y=1.0, x=0),
            dragmode="pan",
        )
    return fig


with left:
    event = st.plotly_chart(
        _build_figure(),
        key=f"chart_{view_mode}_{projection}_{color_by}_{tuple(brain_filter) if brain_filter else ()}",
        on_select="rerun",
        selection_mode=["points"],
        width="stretch",
    )

# ---------- Patch viewer ----------
with right:
    selected = event.selection.get("points") if event and event.selection else []
    if not selected:
        st.info("Click a point in the plot to view its patch.")
    else:
        pt = selected[0]
        global_idx = int(pt["customdata"][0])
        row = meta.iloc[global_idx]
        patch = load_patch(row["scan_name"], int(row["patch_idx"]))
        st.image(
            patch_to_uint8(patch),
            caption=f"global idx {global_idx} · {row['scan_name']}",
            width="stretch",
        )

        st.markdown(
            f"**Condition:** {row['condition']}  ·  **Brain:** #{row['brain_idx']} ({row['animal_nr']})"
        )
        st.markdown(
            "**Quality metrics**\n\n"
            f"- sharpness · `{row['sharpness']:.2f}`\n"
            f"- snr · `{row['snr']:.2f}`\n"
            f"- local_contrast · `{row['local_contrast']:.2f}`\n"
            f"- foreground_fraction · `{row['foreground_fraction']:.2f}`\n"
            f"- mean_intensity · `{row['mean_intensity']:.1f}`\n"
            f"- std_intensity · `{row['std_intensity']:.1f}`"
        )
        st.markdown(
            "**Source position**  \n"
            f"z = {row['z_mid_absolute']}  ·  y0 = {row['y0']}  ·  x0 = {row['x0']}"
        )
