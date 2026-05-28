---
language:
- en
- ko
library_name: transformers
license: apache-2.0
pipeline_tag: text-generation
model_id: kakaocorp/kanana-1.5-2.1b-instruct-2505
repo: kakaocorp/kanana-1.5-2.1b-instruct-2505
developers: Kanana LLM
training_regime: bf16 mixed precision
---

<p align="center">
<br>
    <picture>
        <img src="./assets/logo/kanana-logo.png" width="60%" style="margin: 40px auto;">
    </picture>
</br>

<p align="center">
🤗 <a href="https://kko.kakao.com/kananallm">1.5 HF Models</a> &nbsp |
&nbsp 📕 <a href="https://tech.kakao.com/posts/707">1.5 Blog</a> &nbsp |
&nbsp 📜 <a href="https://arxiv.org/abs/2502.18934">Technical Report</a>


<br>

## News 🔥

- ✨`2025/05/23`: Published a [blog post](https://tech.kakao.com/posts/707) about `Kanana 1.5` models and released 🤗[HF model weights](https://kko.kakao.com/kananallm).
- 📜`2025/02/27`: Released [Technical Report](https://arxiv.org/abs/2502.18934) and 🤗[HF model weights](https://huggingface.co/collections/kakaocorp/kanana-nano-21b-67a326cda1c449c8d4172259).
- 📕`2025/01/10`: Published a [blog post](https://tech.kakao.com/posts/682) about the development of `Kanana Nano` model.
- 📕`2024/11/14`: Published blog posts ([pre-training](https://tech.kakao.com/posts/661), [post-training](https://tech.kakao.com/posts/662)) about the development of `Kanana` models.
- ▶️`2024/11/06`: Published a [presentation video](https://youtu.be/HTBl142x9GI?si=o_we6t9suYK8DfX3) about the development of the `Kanana` models.

<br>

## Table of Contents

- [Kanana 1.5](#kanana-15)
    - [Performance](#performance)
        - [Base Model Evaluation](#base-model-evaluation)
        - [Instruct Model Evaluation](#instruct-model-evaluation)
- [Contributors](#contributors)
- [Citation](#citation)
- [Contact](#contact)

<br>

# Kanana 1.5

`Kanana 1.5`, a newly introduced version of the Kanana model family, presents substantial enhancements in **coding, mathematics, and function calling capabilities** over the previous version, enabling broader application to more complex real-world problems. This new version now can handle __up to 32K tokens length natively and up to 128K tokens using YaRN__, allowing the model to maintain coherence when handling extensive documents or engaging in extended conversations. Furthermore, Kanana 1.5 delivers more natural and accurate conversations through a __refined post-training process__.

<p align="center">
<br>
    <picture>
        <img src="./assets/performance/kanana-1.5-radar-2.1b.png" width="95%" style="margin: 40px auto;">
    </picture>
</br>

> [!Note]
> Neither the pre-training nor the post-training data includes Kakao user data.

## Performance

### Base Model Evaluation
<table>
    <tr>
        <th>Models</th>
        <th>MMLU</th>
        <th>KMMLU</th>
        <th>HAERAE</th>
        <th>HumanEval</th>
        <th>MBPP</th>
        <th>GSM8K</th>
    </tr>
    <tr>
        <td>Kanana-1.5-2.1B</td>
        <td align="center">56.30</td>
        <td align="center">45.10</td>
        <td align="center">77.46</td>
        <td align="center">52.44</td>
        <td align="center">47.00</td>
        <td align="center">55.95</td>
    </tr>
    <tr>
        <td>Kanana-Nano-2.1B</td>
        <td align="center">54.83</td>
        <td align="center">44.80</td>
        <td align="center">77.09</td>
        <td align="center">31.10</td>
        <td align="center">46.20</td>
        <td align="center">46.32</td>
    </tr>
</table>

<br>

### Instruct Model Evaluation
<table>
    <tr>
        <th>Models</th>
        <th>MT-Bench</th>
        <th>KoMT-Bench</th>
        <th>IFEval</th>
        <th>HumanEval+</th>
        <th>MBPP+</th>
        <th>GSM8K (0-shot)</th>
        <th>MATH</th>
        <th>MMLU (0-shot, CoT)</th>
        <th>KMMLU (0-shot, CoT)</th>
        <th>FunctionChatBench</th>
    </tr>
    <tr>
        <td><strong>Kanana-1.5-2.1B*</strong></td>
        <td align="center">7.01</td>
        <td align="center">6.54</td>
        <td align="center">68.61</td>
        <td align="center">68.90</td>
        <td align="center">65.08</td>
        <td align="center">81.43</td>
        <td align="center">60.62</td>
        <td align="center">53.87</td>
        <td align="center">32.93</td>
        <td align="center">53.70</td>
    </tr>
    <tr>
        <td>Kanana-Nano-2.1B</td>
        <td align="center">6.40</td>
        <td align="center">5.90</td>
        <td align="center">71.97</td>
        <td align="center">63.41</td>
        <td align="center">62.43</td>
        <td align="center">72.32</td>
        <td align="center">29.26</td>
        <td align="center">52.48</td>
        <td align="center">38.51</td>
        <td align="center">26.10</td>
    </tr>
</table>

> [!Note]
> \* Models released under Apache 2.0 are trained on the latest versions compared to other models.


<br>


## Contributors
- Language Model Training: Yunju Bak, Doohae Jung, Boseop Kim, Nayeon Kim, Hojin Lee, Jaesun Park, Minho Ryu
- Language Model Alignment: Jiyeon Ham, Seungjae Jung, Hyunho Kim, Hyunwoong Ko, Changmin Lee, Daniel Wontae Nam
- AI Engineering: Youmin Kim, Hyeongju Kim

<br>
 
## Citation
 
```
@misc{kananallmteam2025kananacomputeefficientbilinguallanguage,
      title={Kanana: Compute-efficient Bilingual Language Models}, 
      author={Kanana LLM Team and Yunju Bak and Hojin Lee and Minho Ryu and Jiyeon Ham and Seungjae Jung and Daniel Wontae Nam and Taegyeong Eo and Donghun Lee and Doohae Jung and Boseop Kim and Nayeon Kim and Jaesun Park and Hyunho Kim and Hyunwoong Ko and Changmin Lee and Kyoung-Woon On and Seulye Baeg and Junrae Cho and Sunghee Jung and Jieun Kang and EungGyun Kim and Eunhwa Kim and Byeongil Ko and Daniel Lee and Minchul Lee and Miok Lee and Shinbok Lee and Gaeun Seo},
      year={2025},
      eprint={2502.18934},
      archivePrefix={arXiv},
      primaryClass={cs.CL},
      url={https://arxiv.org/abs/2502.18934}, 
}
```

<br>

## Contact
- Kanana LLM Team Technical Support: kanana-llm@kakaocorp.com
- Business & Partnership Contact: alpha.k@kakaocorp.com