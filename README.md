# explainable-brains-hackathon

## Overarching question: **How to extract meaningful information from complex brain imaging data?**

**Challenge A. Smart image data selection for generalizable AI models**

Problem: Modern AI models can be trained and tuned to solve problems across language, audio, image, and video domains. Yet, the bottleneck often lies in selecting the right data, in sufficient quality and quantity, to train models effectively. In practice, *less is more -* a smaller, well-curated dataset often outperforms a large, noisy one. For image-based signal detection, reliable ground truth is vital, and such label images are typically generated through time-intensive semi-manual processes. The challenge, therefore, is to automatically identify the most informative signal patterns that represent the diversity of the dataset, enabling models to generalize well while minimizing the need for manual labeling.

Solution:  Develop a method to characterize signal patterns in image patches (small subvolumes) extracted from whole-brain scans, and use this characterization to select an optimal set of patches that captures the full diversity of signal patterns in the dataset. Then build an interactive interface that visualizes how the selected patches relate to each other based on their characterization and clustering, making it easy to inspect and validate the final patch selection for AI model training. As an extension, consider allowing users to guide the characterization and patch selection by specifying what constitutes relevant versus irrelevant signal either through natural language descriptions or drawing tools directly on the images.

**Challenge B: Guided brain data exploration for biological insight**

**Problem:** Brain scans go through signal extraction and quantification in Vibraint’s image analysis pipeline. The final output consists of spreadsheets that summarize quantified signal per brain region and sample, and statistical analysis results comparing experimental groups across brain regions. This creates a rich but complex dataset that is difficult to visualize in an informative and intuitive way, both across the whole brain and for individual regions. Another challenge is how to identify, in an unbiased manner, the brain regions where the differences between experimental groups are the most relevant. In practice, the dataset is also simply large and difficult to query, navigate, and interpret efficiently.

**Solution:** Build an intuitive, guided interface that lets users explore the results of whole‑brain analysis. First, choose useful visualizations that show patterns across all regions and allow for detailed inspection of individual regions. Then design a system that automatically highlights regions where the differences between experimental groups are most pronounced and/or most interesting for a given biological question, making this dependent on factors such as the drug, the biological marker that was imaged, and the quantified metric used. Finally, implement a dashboard that can generate these plots on demand. As an extension, add a way for users to ask natural‑language questions about the data and brain regions, request specific plots, or explore which brain regions were identified as most interesting or different between groups.

## Data for challenges

## Setup - Git, Claude, Bucket
Local
LightningAI

##

