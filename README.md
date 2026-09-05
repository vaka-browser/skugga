<p align="center">
  <img src="build/icon.png" width="112" alt="Skugga">
</p>

<h1 align="center">Skugga</h1>

<p align="center">
  <b>Vaka with everything through Tor.</b><br>
  Fail-closed: if the Tor connection is not up, nothing leaves the browser. WebRTC locked. Brave's ad blocker built in.
</p>

<p align="center">
  <a href="https://github.com/northcrafto/skugga-dl/releases/latest"><img src="https://img.shields.io/github/v/release/northcrafto/skugga-dl?label=release&color=7c5cff" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MPL--2.0-blue" alt="MPL-2.0"></a>
  <img src="https://img.shields.io/badge/platforms-Windows%20%7C%20Linux-lightgrey" alt="Platforms">
</p>

<p align="center">
  <a href="https://vaka-web-lovat.vercel.app/skugga-win"><b>Download for Windows</b></a> ·
  <a href="https://vaka-web-lovat.vercel.app/skugga-linux"><b>Linux</b></a>
</p>

---

## How it works

Skugga ships its own Tor (the Tor Project's expert bundle, with the lyrebird and conjure pluggable transports) and starts it before the first tab opens. Every request goes through Tor's SOCKS proxy. If Tor is not running, the proxy configuration points nowhere, so a broken tunnel means no traffic, not leaked traffic.

- **Fail-closed proxying** — no Tor, no network.
- **WebRTC disabled** so your real IP cannot leak through peer connections.
- **Onion search** through Ahmia from the start page.
- **The Vaka base**: Brave's adblock-rust engine, the dangerous-site warning, the password manager and wallet, 54 languages.

Skugga is not the Tor Browser and does not try to be. It does not resist browser fingerprinting the way Tor Browser does. Use it for privacy from your network and the sites you visit, not for anonymity against a state-level adversary.

## Build from source

```bash
git clone https://github.com/vaka-browser/skugga.git
cd skugga
npm install
tools/fetch_tor.sh        # downloads the Tor expert bundle into tor-bundle/
npm start
```

The Tor binaries are not in this repository; `tools/fetch_tor.sh` fetches them from torproject.org and verifies the download. Packaging works as in [Vaka's README](https://github.com/vaka-browser/vaka#packaging).

## Contributing

Same rules as Vaka: [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and security reports through the **Security** tab ([SECURITY.md](SECURITY.md)).

## License

[Mozilla Public License 2.0](LICENSE). Tor is licensed under the BSD 3-clause license by the Tor Project; the pluggable transports under their own licenses.

<p align="center">Made in Sweden.</p>
