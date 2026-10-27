# MD Sample

A small, dependency-free WAV → MIDI Sample Dump Standard (.syx) converter for the Elektron Machinedrum UW. French interface. Runs entirely in the browser; no file uploads, analytics, backend or MIDI permissions. Unofficial community tool, not affiliated with Elektron.

## Use locally

Open `dist/index.html` in a modern browser, choose or drop a WAV, listen to the mono conversion, then download the `.syx`. Keep the four files in `dist` together. No build or installation needed.

Supported: RIFF WAV PCM 8/16/24/32-bit and IEEE float 32/64-bit, mono/stereo, 4–192 kHz input. Output: mono SDS 16-bit at 44.1, 22.05 or 11.025 kHz, device ID 0, sample number 0, loop disabled. Select the destination explicitly on the Machinedrum before sending. Stereo averaging can cancel out-of-phase content; left/right channel options are provided. The waveform represents the source left channel; the audio preview represents converted mono 16-bit PCM, not the UW's final 12-bit playback.

Downsampling uses a 48-tap windowed-sinc filter. No automatic normalization. The converter has a conservative 1,000,000-frame output limit; the UI's PCM byte estimate is not a measurement or guarantee of free device memory. Inputs limited to 80 MiB and 180 seconds. No direct MIDI transmission.

## GitHub Pages

1. Create an empty repository, for example `md-sample`, on GitHub.
2. Put this folder's contents at its root, including `.github/workflows/pages.yml`.
3. Under **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
4. Push to `main` or run the deployment workflow manually.

With that account and repository name, the expected URL is `https://mathieustaub.github.io/md-sample/` once deployment succeeds. It is not live until GitHub confirms deployment.

## Validation

Run `node tests/sds.test.cjs`. Optional: append a local WAV path to validate an entire sample. The tests cover PCM/float decoding, stereo averaging, byte-level SDS decoding, packet checksums, packet counter rollover and downsampling alias suppression. Hardware transfer has not been validated by these software tests.

## References

- [Machinedrum manual](https://www.elektron.se/wp-content/uploads/2024/09/machinedrum_manual_OS1.63_1.pdf)
- MIDI 1.0 Sample Dump Standard: 21-byte header, 127-byte packets, 40 16-bit sample points per packet, offset-binary MSB-first 7-bit encoding and XOR checksum.
