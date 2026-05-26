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

from PIL import Image, ImageDraw

from data import compute_pca, compute_tsne, compute_umap, load_embeddings, load_patch, patch_to_uint8
from jesko.segmentation import segment_patch

st.set_page_config(page_title="Explainable Brains — Embedding explorer", layout="wide")


CATEGORICAL = {
    "condition":     {"Control": "#3b82f6", "Semaglutide": "#ef4444"},
    "brain_idx":     None,    # filled at runtime from a qualitative palette
}

CONTINUOUS = [
    "cfos_activity_score", "n_cfos_puncta", "n_artifacts", "cfos_area_frac",
    "sharpness", "snr", "local_contrast", "foreground_fraction",
    "mean_intensity", "std_intensity", "fraction_signal",
]


@st.cache_data
def _load():
    emb, meta = load_embeddings()
    pca_coords, pca_var = compute_pca(n_components=2)
    umap_coords = compute_umap()
    tsne_coords = compute_tsne()
    return emb, meta, pca_coords, pca_var, umap_coords, tsne_coords


emb, meta, pca_coords, pca_var, umap_coords, tsne_coords = _load()

# ---------- Sidebar controls ----------
with st.sidebar:
    st.header("View")
    projection = st.radio("Projection", ["PCA", "UMAP", "t-SNE"], horizontal=True)

    color_by = st.selectbox(
        "Color by",
        list(CATEGORICAL.keys()) + CONTINUOUS,
        index=0,
    )
    st.markdown("---")
    st.header("Patch viewer")
    show_overlay = st.checkbox("Segmentation overlay", value=True,
                               help="Draw nucleus / artifact outlines on the selected patch.")
    st.markdown("---")
    st.caption(
        f"**{len(meta):,} patches** · 12 brains  \n"
        f"6 Control / 6 Semaglutide  \n"
        f"PLIP 512-d → 2-D"
    )

# ---------- Pick projection ----------
if projection == "PCA":
    coords = pca_coords
    x_label = f"PC1 ({pca_var[0]*100:.1f}%)"
    y_label = f"PC2 ({pca_var[1]*100:.1f}%)"
    subtitle = f"PCA · {pca_var.sum()*100:.1f}% explained"
elif projection == "UMAP":
    coords = umap_coords
    x_label = "UMAP-1"
    y_label = "UMAP-2"
    subtitle = "UMAP · cosine, n_neighbors=15, min_dist=0.1"
else:  # t-SNE
    coords = tsne_coords
    x_label = "t-SNE-1"
    y_label = "t-SNE-2"
    subtitle = "t-SNE · perplexity=30, init=pca"
visible_idx = np.arange(len(meta))

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
    fig = go.Figure()
    if color_by in CATEGORICAL:
        if color_by == "brain_idx":
            palette = px.colors.qualitative.Light24
            cats = sorted(meta["brain_idx"].unique())
            cats_colors = [(c, palette[i % len(palette)]) for i, c in enumerate(cats)]
        else:
            cats_colors = list(CATEGORICAL[color_by].items())

        for cat, col in cats_colors:
            mask = (meta[color_by].values == cat)
            idx = np.where(mask)[0]
            idx = np.intersect1d(idx, visible_idx, assume_unique=True)
            if len(idx) == 0:
                continue
            fig.add_trace(go.Scattergl(
                x=coords[idx, 0], y=coords[idx, 1],
                mode="markers",
                marker=dict(size=4, color=col, opacity=0.55),
                name=str(cat),
                customdata=_customdata(idx),
                hovertemplate=HOVER,
            ))
    else:
        idx = visible_idx
        if len(idx) > 0:
            vals = meta[color_by].values[idx].astype(float)
            cmin, cmax = np.percentile(vals, [1, 99])
            fig.add_trace(go.Scattergl(
                x=coords[idx, 0], y=coords[idx, 1],
                mode="markers",
                marker=dict(
                    size=4, color=vals, opacity=0.7,
                    colorscale="Viridis", cmin=cmin, cmax=cmax,
                    showscale=True,
                    colorbar=dict(title=color_by, len=0.6, thickness=12),
                ),
                customdata=_customdata(idx),
                hovertemplate=HOVER,
                showlegend=False,
            ))

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
        key=f"chart_{projection}_{color_by}",
        on_select="rerun",
        selection_mode=["points"],
        width="stretch",
    )

def _render_patch(patch_u16, overlay):
    """Return (PIL RGB image, seg-or-None). Overlay draws c-Fos puncta / artifact outlines."""
    img = Image.fromarray(patch_to_uint8(patch_u16)).convert("RGB")
    if not overlay:
        return img, None
    seg = segment_patch(patch_u16)
    draw = ImageDraw.Draw(img)
    for r in seg.cfos_props:
        cy, cx = r.centroid
        draw.ellipse((cx - 3, cy - 3, cx + 3, cy + 3), outline=(0, 255, 0), width=1)
    for r in seg.artifacts_props:
        miny, minx, maxy, maxx = r.bbox
        draw.rectangle((minx, miny, maxx, maxy), outline=(255, 80, 80), width=1)
    return img, seg


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

        img, seg = _render_patch(patch, overlay=show_overlay)
        if seg is not None:
            cap = (f"global idx {global_idx} · "
                   f"{seg.n_cfos_puncta} c-Fos+ puncta (green) · {seg.n_artifacts} artifacts (red)")
        else:
            cap = f"global idx {global_idx} · {row['scan_name']}"
        st.image(img, caption=cap, width="stretch")

        st.markdown(
            f"**Condition:** {row['condition']}  ·  **Brain:** #{row['brain_idx']} "
            f"({row['animal_nr']})"
        )
        st.markdown(
            "**c-Fos+ signal**\n\n"
            f"- cfos_activity_score · `{row.get('cfos_activity_score', float('nan')):.3f}` (in [0, 1] — activity, not patch quality)\n"
            f"- n_cfos_puncta · `{int(row.get('n_cfos_puncta', 0))}`\n"
            f"- n_artifacts · `{int(row.get('n_artifacts', 0))}`\n"
            f"- cfos_area_frac · `{row.get('cfos_area_frac', 0):.3f}`"
        )
        st.markdown(
            "**Per-patch metrics (organizer-provided)**\n\n"
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
