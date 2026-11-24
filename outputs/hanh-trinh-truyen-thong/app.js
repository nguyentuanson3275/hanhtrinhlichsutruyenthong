"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const make = (tag, value, className) => {
  const element = document.createElement(tag);
  if (value) element.textContent = value;
  if (className) element.className = className;
  return element;
};
const number = new Intl.NumberFormat("vi-VN");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const sectionLinks = [...document.querySelectorAll(".timeline a")];
const chapters = [...document.querySelectorAll(".stage")];

function showChapter(chapter) {
  document.body.dataset.theme = chapter.dataset.theme;
  for (const link of sectionLinks) {
    if (link.hash === "#" + chapter.id) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}

let scrollFrame = 0;
function updateReading() {
  const scrollable = document.documentElement.scrollHeight - innerHeight;
  $("#reading-fill").style.transform = "scaleX(" + (scrollable > 0 ? scrollY / scrollable : 0) + ")";
  scrollFrame = 0;
}
function queueReading() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateReading);
}
addEventListener("scroll", queueReading, { passive: true });
addEventListener("resize", queueReading);
if ("ResizeObserver" in window) new ResizeObserver(queueReading).observe(document.body);
queueReading();

if ("IntersectionObserver" in window) {
  const visibleChapters = new Set();
  const chapterObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) visibleChapters.add(entry.target);
      else visibleChapters.delete(entry.target);
    }
    const midpoint = innerHeight * .405;
    const active = [...visibleChapters].find(chapter => {
      const bounds = chapter.getBoundingClientRect();
      return bounds.top <= midpoint && bounds.bottom > midpoint;
    }) || entries.find(entry => entry.isIntersecting)?.target || [...visibleChapters][0];
    if (active) showChapter(active);
  }, { rootMargin: "-39% 0px -58% 0px" });
  chapters.forEach(chapter => chapterObserver.observe(chapter));

  const counter = $("#print-count");
  const countObserver = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    countObserver.disconnect();
    if (motion.matches) {
      counter.textContent = "180";
      return;
    }
    const started = performance.now();
    function count(now) {
      const progress = Math.min(1, (now - started) / 1350);
      counter.textContent = number.format(Math.round(180 * (1 - (1 - progress) ** 3)));
      if (progress < 1) requestAnimationFrame(count);
    }
    requestAnimationFrame(count);
  }, { threshold: .3 });
  if (!motion.matches) counter.textContent = "0";
  countObserver.observe($(".counter"));
}

const torch = $("#torch");
let torchX = 62;
let torchY = 42;
function lightTorch(x, y) {
  torchX = Math.max(0, Math.min(100, x));
  torchY = Math.max(0, Math.min(100, y));
  torch.style.setProperty("--x", torchX + "%");
  torch.style.setProperty("--y", torchY + "%");
}
function pointTorch(event) {
  const area = torch.getBoundingClientRect();
  lightTorch(100 * (event.clientX - area.left) / area.width, 100 * (event.clientY - area.top) / area.height);
}
torch.addEventListener("pointermove", event => {
  if (event.pointerType !== "touch") pointTorch(event);
});
torch.addEventListener("pointerdown", pointTorch);
torch.addEventListener("keydown", event => {
  const offset = { ArrowLeft: [-7, 0], ArrowRight: [7, 0], ArrowUp: [0, -7], ArrowDown: [0, 7] }[event.key];
  if (!offset) return;
  event.preventDefault();
  lightTorch(torchX + offset[0], torchY + offset[1]);
});

const glyphs = [
  { name: "Mặt trời", code: "N5", shape: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1"/>' },
  { name: "Mắt", code: "D4", shape: '<path d="M2 12Q12 2 22 12Q12 22 2 12Z"/><circle cx="12" cy="12" r="2.7"/>' },
  { name: "Con cú", code: "G17", shape: '<path d="M8 8Q8 3 13 3Q18 3 18 8L18 16L16 21H11L11 17L5 20L8 12Z"/><circle cx="11" cy="7" r=".6"/><circle cx="15" cy="7" r=".6"/><path d="M11 12L15 16"/>' },
  { name: "Nước", code: "N35", shape: '<path d="M2 14L5 10L8 14L12 10L16 14L19 10L22 14"/>' }
];
const glyphControls = $("#glyph-controls");
const glyphList = make("div", "", "glyph-list");
const glyphChoices = make("div", "", "button-row");
const glyphFeedback = make("p", "", "feedback");
glyphFeedback.setAttribute("role", "status");
let currentGlyph = 0;
const solvedGlyphs = new Set();
function selectGlyph(index) {
  currentGlyph = index;
  [...glyphList.children].forEach((button, i) => button.setAttribute("aria-pressed", i === index));
  glyphFeedback.textContent = "Ký tự " + (index + 1) + " · Đã giải " + solvedGlyphs.size + "/4";
}
glyphs.forEach((glyph, index) => {
  const button = make("button");
  button.setAttribute("aria-label", "Ký tự " + (index + 1));
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + glyph.shape + "</svg>";
  button.addEventListener("click", () => selectGlyph(index));
  glyphList.append(button);
});
for (const option of [glyphs[2], glyphs[3], glyphs[0], glyphs[1]]) {
  const button = make("button", option.name);
  button.addEventListener("click", () => {
    if (glyphs[currentGlyph] !== option) {
      glyphFeedback.textContent = "Chưa khớp. Quan sát đường nét rồi thử lại.";
      return;
    }
    solvedGlyphs.add(currentGlyph);
    glyphFeedback.textContent = "Đúng! " + option.name + " · Dấu Gardiner " + option.code + " · Đã giải " + solvedGlyphs.size + "/4";
  });
  glyphChoices.append(button);
}
glyphControls.append(glyphList, glyphChoices, glyphFeedback);
selectGlyph(0);

let audioContext;
function getAudio() {
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) return null;
  audioContext ||= new AudioEngine();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  return audioContext;
}
function playNotes(notes, volume = .08) {
  const context = getAudio();
  if (!context) return;
  let time = context.currentTime;
  for (const frequency of notes) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(.001, time + .16);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + .18);
    time += .14;
  }
}
const stations = [
  { frequency: 90.1, name: "Bản tin buổi sáng", notes: [420, 560, 680] },
  { frequency: 96.5, name: "Âm nhạc cuối tuần", notes: [392, 494, 587] },
  { frequency: 101.3, name: "Nhạc không lời" },
  { frequency: 103.7, name: "Trò chuyện cùng thính giả", notes: [330, 440, 554] }
];

let instrumentalBuffer;
function playFMInstrumental() {
  const context = getAudio();
  if (!context) return;
  const beat = .46;
  if (!instrumentalBuffer) {
    const rate = context.sampleRate;
    instrumentalBuffer = context.createBuffer(1, Math.ceil(18 * beat * rate), rate);
    const samples = instrumentalBuffer.getChannelData(0);
    const melody = [
      [0, 64], [1, 67], [1.5, 69], [2.5, 72], [3.5, 67],
      [4, 69], [5, 72], [6, 76], [7, 74],
      [8, 72], [9, 69], [10, 67], [11, 64],
      [12, 62], [13, 67], [14, 64], [15, 60]
    ];
    const chords = [[48, 55, 60], [45, 52, 60], [41, 48, 57], [43, 50, 59], [48, 52, 55]];
    function pluck(position, note, length, volume) {
      const offset = Math.round(position * beat * rate);
      const size = Math.min(Math.round(length * beat * rate), samples.length - offset);
      const frequency = 440 * 2 ** ((note - 69) / 12);
      for (let i = 0; i < size; i++) {
        const time = i / rate;
        const phase = 2 * Math.PI * frequency * time;
        const envelope = Math.min(1, time / .008, (size - i - 1) / (.03 * rate)) * Math.exp(-4.6 * time);
        samples[offset + i] += volume * envelope * (Math.sin(phase) + .24 * Math.sin(2 * phase));
      }
    }
    melody.forEach(([position, note]) => pluck(position, note, 1.5, .11));
    chords.forEach((chord, measure) => {
      chord.forEach((note, step) => pluck(measure * 4 + step * .22, note, 2.8, .045));
    });
  }
  const source = context.createBufferSource();
  const level = context.createGain();
  source.buffer = instrumentalBuffer;
  source.connect(level).connect(context.destination);
  source.start();
  return () => {
    const now = context.currentTime;
    level.gain.setTargetAtTime(0, now, .007);
    source.stop(now + .035);
  };
}

const fm = $("#fm");
const fmButton = $("#fm-sound");
let fmAudio = false;
let previousStation;
let lastNoise = 0;
let stopInstrumental;
function renderFM(forceSound = false) {
  const frequency = Number(fm.value);
  const station = stations.find(item => Math.abs(item.frequency - frequency) < .26);
  $("#fm-value").textContent = frequency.toLocaleString("vi-VN", { minimumFractionDigits: 1 }) + " MHz";
  const announcement = station ? "Bắt sóng · " + station.name + " (đài giả lập)" : "Nhiễu sóng · Thử 90,1 / 96,5 / 101,3 / 103,7 MHz";
  if ($("#fm-station").textContent !== announcement) $("#fm-station").textContent = announcement;
  if (station !== previousStation || forceSound) {
    stopInstrumental?.();
    stopInstrumental = undefined;
    if (fmAudio && station) {
      if (station.notes) playNotes(station.notes);
      else stopInstrumental = playFMInstrumental();
    }
  }
  if (fmAudio && !station && performance.now() - lastNoise > 280) {
    lastNoise = performance.now();
    const context = getAudio();
    if (context) {
      const buffer = context.createBuffer(1, Math.floor(context.sampleRate * .12), context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * .09 * (1 - i / samples.length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start();
    }
  }
  previousStation = station;
}
fm.addEventListener("input", () => renderFM());
fmButton.addEventListener("click", () => {
  fmAudio = !fmAudio;
  fmButton.setAttribute("aria-pressed", fmAudio);
  fmButton.textContent = fmAudio ? "Tắt âm dò sóng" : "Bật âm dò sóng";
  renderFM(true);
});
renderFM();

const channels = [
  ["Kênh 01 · Tin tức", "Bản tin cập nhật tình hình giao thông buổi sáng.", "17", "Người dẫn ngồi tại bàn bản tin, phía sau là bản đồ thế giới."],
  ["Kênh 02 · Chương trình", "Khách mời kể chuyện hậu trường một buổi biểu diễn.", "18", "Người dẫn và khách mời trò chuyện trong trường quay."],
  ["Kênh 03 · Phóng sự trực tiếp", "Phóng viên kết nối từ hiện trường trên phố.", "19", "Phóng viên cầm micro trên đường phố dưới trời mưa."]
];
let tvChannel = 0;
function changeTV(offset) {
  tvChannel = (tvChannel + offset + channels.length) % channels.length;
  const [title, description, picture, alt] = channels[tvChannel];
  const image = make("img");
  image.alt = alt;
  image.width = 960;
  image.height = 540;
  image.loading = "lazy";
  image.src = "images/" + picture + ".jpg";
  $("#tv-picture").replaceChildren(image);
  $("#tv-caption").replaceChildren(make("strong", title), make("span", description));
}
$("#tv-prev").addEventListener("click", () => changeTV(-1));
$("#tv-next").addEventListener("click", () => changeTV(1));
changeTV(0);

const media = [
  ["Tranh hang động", "vách đá tiền sử ánh đuốc", "#chuong-1"],
  ["Chữ viết", "tượng hình hình nêm giấy cói papyrus", "#chuong-2"],
  ["Sách và xuất bản", "Gutenberg máy in ấn phẩm tạp chí", "#chuong-3"],
  ["Báo chí in", "báo in bản tin tạp chí Gutenberg", "#chuong-3"],
  ["Phát thanh", "radio FM âm thanh", "#radio"],
  ["Truyền hình", "TV tin tức trực tiếp", "#tv"],
  ["Điện ảnh", "phim 35mm phim tài liệu rạp", "#chuong-4"],
  ["Quảng cáo truyền thống", "báo radio TV ngoài trời biển bảng", "#chuong-4"],
  ["Báo chí điện tử", "báo mạng multimedia scrollytelling", "#kenh-bao-dien-tu"],
  ["Mạng xã hội", "Facebook Instagram TikTok bình luận", "#kenh-mang-xa-hoi"],
  ["Video trực tuyến", "YouTube livestream Shorts video ngắn", "#kenh-video"],
  ["Podcast", "âm thanh audio on demand video podcast", "#kenh-podcast"],
  ["OTT / Streaming", "Netflix truyền hình Internet xem theo yêu cầu", "#kenh-ott"],
  ["Nền tảng tìm kiếm", "Google Search từ khóa", "#kenh-tim-kiem"],
  ["Creator & Influencer", "nhà sáng tạo người ảnh hưởng", "#kenh-creator"],
  ["AI và trung gian thông tin", "chatbot AI gợi ý tổng hợp thuật toán", "#kenh-ai"]
];
function normalize(value) {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "d").trim();
}
const searchField = $("#media-search");
function renderSearch() {
  const terms = normalize(searchField.value).split(/\s+/);
  const found = media.filter(([name, keywords]) => terms.every(term => normalize(name + " " + keywords).includes(term)));
  $("#search-count").textContent = found.length ? number.format(found.length) + " mục phù hợp" : "Không tìm thấy. Thử một từ khóa khác.";
  $("#search-results").replaceChildren(...found.map(([name, , hash]) => {
    const link = make("a", name);
    link.href = hash;
    const item = make("li");
    item.append(link);
    return item;
  }));
}
searchField.addEventListener("input", renderSearch);
renderSearch();

const hubs = [
  ["Báo chí điện tử", "09", "Tòa soạn và những màn hình tin tức", "Tòa soạn chọn góc tiếp cận và kiểm chứng trước khi xuất bản. Một bài báo mạng có thể cập nhật diễn biến mới và dẫn người đọc đến tài liệu gốc."],
  ["Mạng xã hội", "10", "Các điện thoại nối với nhau qua những luồng sáng", "Facebook, Instagram và TikTok tổ chức nội dung thành dòng tin để người dùng tương tác và chia sẻ. Thứ tự hiển thị chịu ảnh hưởng từ quan hệ, hành vi và hệ thống gợi ý."],
  ["Video trực tuyến", "11", "Máy quay và điện thoại trong studio livestream", "YouTube và các nền tảng video đưa video dài, clip ngắn và livestream đến người xem. Livestream tạo một cuộc gặp cùng thời điểm, còn video lưu trữ có thể xem lại sau."],
  ["Podcast", "12", "Hai micro với sóng âm phát sáng", "Podcast phát hành nội dung thành tập để người nghe chọn thời điểm phát. Một tập có thể chỉ có âm thanh hoặc có thêm phiên bản video podcast."],
  ["OTT / Streaming", "13", "Người xem chọn phim trên TV trong phòng khách", "Dịch vụ như Netflix và truyền hình Internet phân phối chương trình qua mạng. Danh mục theo yêu cầu cho phép người xem tự chọn nội dung và thời điểm phát."],
  ["Nền tảng tìm kiếm", "14", "Kính lúp phóng lớn các mảnh dữ liệu", "Google Search và các công cụ tìm kiếm xếp hạng trang theo truy vấn. Từ khóa và nhiều tín hiệu khác có thể đổi thứ tự kết quả mà người dùng nhìn thấy."],
  ["Creator & Influencer", "15", "Nhà sáng tạo ghi hình phía trên thành phố", "Creator tự xây dựng nội dung và cộng đồng, còn influencer tác động đến lựa chọn của người theo dõi. Một người có thể đảm nhiệm cả hai vai trò và cần công khai quan hệ tài trợ khi giới thiệu sản phẩm."],
  ["AI và trung gian thông tin", "16", "Lăng kính AI kết hợp hình ảnh, sóng âm và dữ liệu", "Chatbot có thể tổng hợp câu trả lời, còn hệ thống gợi ý chọn nội dung để đưa lên trước. Người đọc cần đối chiếu nguồn gốc thông tin và những chi tiết có thể kiểm chứng."]
];
const tabs = $("#hub-tabs");
const panel = $("#hub-panel");
let currentHub = -1;
let stopDemo = () => {};

function demoButton(label, handler) {
  const button = make("button", label);
  button.addEventListener("click", handler);
  return button;
}

function createDemo(index) {
  const box = make("div", "", "mini");
  box.append(make("span", "Mô phỏng · Dữ liệu minh họa", "sim-label"));
  const output = make("p", "", "feedback");
  output.setAttribute("aria-live", "polite");
  const row = make("div", "", "button-row sim-control");
  switch (index) {
    case 0: {
      box.append(make("strong", "Thư viện thành phố mở cửa trở lại"));
      const details = make("details", "", "sim-control");
      details.append(make("summary", "Đọc bản cập nhật"), make("p", "09:30 · Phòng đọc mở cửa trước. Khu mượn sách hoạt động lại vào ngày mai, theo thông báo của thư viện trong tình huống giả định."));
      box.append(details);
      break;
    }
    case 1: {
      box.append(make("strong", "Ảnh hôm nay · Đọc sách ở sân ga"));
      let liked = false;
      const button = demoButton("Thích · 24", () => {
        liked = !liked;
        button.textContent = "Thích · " + (liked ? 25 : 24);
        button.setAttribute("aria-pressed", liked);
      });
      button.setAttribute("aria-pressed", "false");
      const form = make("form", "", "sim-control");
      const label = make("label", "Bình luận");
      label.htmlFor = "demo-comment";
      const field = make("input");
      field.type = "text";
      field.id = "demo-comment";
      field.required = true;
      field.maxLength = 120;
      const send = make("button", "Đăng bình luận", "sim-control");
      form.append(label, field, send);
      form.addEventListener("submit", event => {
        event.preventDefault();
        const message = field.value.trim();
        if (!message) return;
        output.textContent = "Bạn: " + message;
        form.reset();
      });
      box.append(row, form, output);
      row.append(button);
      break;
    }
    case 2:
    case 3:
    case 4: {
      const clips = {
        2: [["Video ngắn", "Cảnh 1 · Toàn cảnh studio", "Cảnh 2 · Góc cận máy quay", "Cảnh 3 · Lời kết"], ["Livestream", "Kết nối trường quay", "Đang trực tiếp · Người dẫn trả lời câu hỏi", "Buổi phát đã kết thúc"]],
        3: [["Tập âm thanh", "Mở đầu · Lời chào thính giả", "Nội dung · Chuyện hậu trường radio", "Kết · Hẹn gặp ở tập sau"], ["Video podcast", "Góc máy 1 · Người dẫn", "Góc máy 2 · Khách mời", "Khung kết · Tên tập"]],
        4: [["Phim tài liệu", "Mở cảnh · Một thành phố thức dậy", "Chương 2 · Nhịp sống trên đường phố", "Hết phim"], ["Phim truyện", "Mở cảnh · Cuộc gặp tại sân ga", "Phân đoạn 2 · Chuyến tàu rời ga", "Hết phim"]]
      }[index];
      let clip = 0;
      let seconds = 0;
      let playback;
      const podcast = index === 3 ? new Audio("data:audio/mp4;base64," + $("#podcast-recording").textContent.replace(/\s/g, "")) : null;
      const frames = { 2: [["11", "15", "10"], ["11", "06", "15"]], 3: [["12", "12", "12"], ["12", "11", "12"]], 4: [["13", "08", "09"], ["13", "08", "07"]] }[index];
      const player = make("div", "", "sim-player");
      const frame = make("img");
      frame.alt = "";
      const waveform = make("div", "", "sim-wave");
      waveform.setAttribute("aria-hidden", "true");
      for (const height of [14, 25, 18, 43, 32, 60, 44, 24, 39, 56, 31, 20, 41, 25, 16]) {
        const bar = make("i");
        bar.style.height = height + "%";
        waveform.append(bar);
      }
      player.append(frame, waveform);
      const seek = make("input");
      seek.type = "range";
      seek.min = 0;
      seek.max = 12;
      seek.step = 1;
      seek.setAttribute("aria-label", "Vị trí phát mô phỏng");
      seek.addEventListener("input", () => {
        seconds = Number(seek.value);
        if (podcast?.readyState) podcast.currentTime = Math.min(seconds, podcast.duration);
        display();
        if (seconds === 12) pause();
      });
      function display() {
        seek.value = seconds;
        const scene = seconds >= 12 ? 3 : 1 + Math.floor(seconds / 4);
        const caption = clips[clip][scene];
        if (output.textContent !== caption) output.textContent = caption;
        const picture = "images/" + frames[clip][scene - 1] + ".jpg";
        if (frame.getAttribute("src") !== picture) frame.src = picture;
        const audioOnly = index === 3 && clip === 0;
        frame.hidden = audioOnly;
        waveform.hidden = !audioOnly;
        seek.disabled = index === 2 && clip === 1;
        seek.setAttribute("aria-valuetext", seconds + " trên 12 giây");
      }
      const play = demoButton("Phát mô phỏng", () => {
        if (playback) {
          pause();
          return;
        }
        if (seconds >= 12) seconds = 0;
        display();
        play.textContent = "Tạm dừng";
        player.classList.add("playing");
        if (podcast && (!podcast.readyState || seconds < podcast.duration)) {
          podcast.currentTime = seconds;
          podcast.play().catch(() => {});
        }
        playback = setInterval(() => {
          seconds++;
          display();
          if (seconds >= 12) pause();
        }, 1000);
      });
      function pause() {
        clearInterval(playback);
        playback = undefined;
        podcast?.pause();
        play.textContent = "Phát mô phỏng";
        player.classList.remove("playing");
      }
      const options = clips.map(([title], i) => demoButton(title, () => {
        pause();
        clip = i;
        seconds = 0;
        options.forEach((button, j) => button.setAttribute("aria-pressed", i === j));
        display();
      }));
      options.forEach((button, i) => button.setAttribute("aria-pressed", i === 0));
      row.append(...options, play);
      box.append(player, row, output, seek);
      if (podcast) {
        const transcript = make("details", "", "sim-control");
        transcript.append(make("summary", "Đọc lời thoại"), make("p", "Bạn đang nghe Chuyện sau làn sóng. Với phát thanh, ta đón chương trình đúng giờ. Với podcast, ta chọn tập và nghe khi thuận tiện."));
        box.append(transcript);
      }
      display();
      stopDemo = pause;
      break;
    }
    case 5: {
      const label = make("label", "Tìm trong kho mô phỏng");
      label.htmlFor = "hub-search";
      const input = make("input");
      input.id = "hub-search";
      input.type = "search";
      input.placeholder = "Ví dụ: sách, Web, FM";
      input.addEventListener("input", search);
      function search() {
        const query = normalize(input.value);
        const results = media.filter(([title, terms]) => normalize(title + " " + terms).includes(query)).slice(0, 4);
        output.textContent = query ? results.map(([title]) => title).join(" · ") || "Không có kết quả phù hợp." : "Nhập từ khóa để hiện các mục phù hợp.";
      }
      box.append(label, input, output);
      search();
      break;
    }
    case 6: {
      let subscribed = false;
      box.append(make("strong", "Nhật ký người kể chuyện"));
      const follow = demoButton("Theo dõi", () => {
        subscribed = !subscribed;
        follow.setAttribute("aria-pressed", subscribed);
        follow.textContent = subscribed ? "Đang theo dõi" : "Theo dõi";
        output.textContent = subscribed ? "Bạn sẽ thấy bài mới của kênh trong mục đang theo dõi." : "Đã bỏ theo dõi kênh.";
      });
      follow.setAttribute("aria-pressed", "false");
      const sponsored = demoButton("Xem công bố tài trợ", () => {
        output.textContent = "Tập này có tài trợ giả lập. Người xem có thể cân nhắc quan hệ thương mại khi đánh giá lời giới thiệu.";
      });
      row.append(follow, sponsored);
      box.append(row, output);
      break;
    }
    case 7: {
      const evidence = make("a", "Đối chiếu với CERN");
      evidence.href = "https://home.cern/science/computing/the-birth-of-the-web";
      evidence.hidden = true;
      row.append(
        demoButton("Hỏi: Web ra đời khi nào?", () => {
          output.textContent = "Tóm tắt mẫu: Tim Berners-Lee đề xuất Web tại CERN năm 1989. CERN đưa phần mềm Web vào phạm vi công cộng năm 1993.";
          evidence.hidden = false;
        }),
        demoButton("Đổi ưu tiên gợi ý", () => {
          const highlightWeb = evidence.hidden;
          output.textContent = highlightWeb ? "Ưu tiên theo chủ đề · Đọc lại mốc Web ở Chương 5." : "Ưu tiên theo định dạng · Thử bản tin hoặc video ngắn.";
          evidence.hidden = !highlightWeb;
        })
      );
      box.append(row, output, evidence);
      break;
    }
  }
  return box;
}

function selectHub(index, focus = false) {
  if (index === currentHub) {
    if (focus) tabs.children[index].focus();
    return;
  }
  stopDemo();
  stopDemo = () => {};
  currentHub = index;
  [...tabs.children].forEach((tab, i) => {
    tab.setAttribute("aria-selected", i === index);
    tab.tabIndex = i === index ? 0 : -1;
  });
  const [title, picture, alt, description] = hubs[index];
  const figure = make("figure", "", "hub-picture");
  const image = make("img");
  image.src = "images/" + picture + ".jpg";
  image.alt = alt;
  image.width = 1440;
  image.height = 810;
  figure.append(image);
  const text = make("div", "", "hub-text");
  text.append(make("h3", title), make("p", description), createDemo(index));
  panel.setAttribute("aria-labelledby", tabs.children[index].id);
  panel.replaceChildren(figure, text);
  if (focus) tabs.children[index].focus();
}
hubs.forEach(([name], index) => {
  const tab = make("button", name);
  tab.type = "button";
  tab.id = media[index + 8][2].slice(1);
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-controls", panel.id);
  tab.addEventListener("click", () => selectHub(index));
  tabs.append(tab);
});
tabs.addEventListener("keydown", event => {
  const steps = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
  let target;
  if (event.key === "Home") target = 0;
  else if (event.key === "End") target = hubs.length - 1;
  else if (event.key in steps) target = (currentHub + steps[event.key] + hubs.length) % hubs.length;
  else return;
  event.preventDefault();
  selectHub(target, true);
});
function followHubLink() {
  const index = media.slice(8).findIndex(([, , hash]) => hash === location.hash);
  if (index < 0) return;
  selectHub(index);
  $("#chuong-6").scrollIntoView();
}
$("#search-results").addEventListener("click", event => {
  const link = event.target.closest("a");
  if (link && link.hash === location.hash) followHubLink();
});
addEventListener("hashchange", followHubLink);
selectHub(0);
followHubLink();

const questions = [
  [
    "Điểm chuyển dịch bản chất nhất giúp chữ tượng hình cổ đại khác với tranh hang động thời tiền sử là gì?",
    [
      "Sử dụng chất liệu bền vững hơn để lưu giữ hình ảnh qua hàng chục thế kỷ mà không bị phai mờ",
      "Chuyển từ mô tả trực quan cảnh vật sang hệ thống ký hiệu quy ước biểu thị khái niệm và âm thanh",
      "Lần đầu tiên tái hiện được sinh hoạt săn bắt, thiên nhiên và các nghi lễ tín ngưỡng của cộng đồng",
      "Giúp thông điệp tồn tại độc lập với người nói thay vì biến mất ngay khi âm thanh lời nói dứt"
    ],
    1,
    "A, C, D đều có ở tranh hang động; bước nhảy bản chất của chữ viết là hệ thống ký hiệu quy ước mã hóa khái niệm và âm thanh."
  ],
  [
    "Cuộn giấy cói (Papyrus) đã giúp tri thức thoát khỏi sự cố định của vách đá, nhưng đến máy in chữ rời của Gutenberg (1440) mới thực sự mở ra kỷ nguyên truyền thông đại chúng chủ yếu vì lý do nào?",
    [
      "Lần đầu tiên tạo ra chất liệu giấy mỏng nhẹ giúp tài liệu lưu thông thuận tiện giữa các vùng đất",
      "Lần đầu tiên chuẩn hóa hệ thống chữ viết thành văn thay thế hoàn toàn văn hóa truyền miệng",
      "Cơ giới hóa việc nhân bản hàng loạt, hạ mạnh chi phí để số đông công chúng cùng tiếp cận một văn bản",
      "Cho phép truyền tải tin tức tức thời giữa các đô thị lớn vượt qua rào cản khoảng cách địa lý"
    ],
    2,
    "A là vai trò của giấy cói/giấy, B là chữ viết, D là điện báo/sóng vô tuyến; Gutenberg tạo bước ngoặt ở nhân bản hàng loạt giá rẻ."
  ],
  [
    "Cùng phát triển trên nền tảng công nghệ in ấn, điểm khác biệt cốt lõi về chức năng giữa Báo chí in và Sách & xuất bản là gì?",
    [
      "Báo chí in thiên về cập nhật thời sự định kỳ và tạo không gian dư luận, còn sách hệ thống hóa tri thức có chiều sâu dài hạn",
      "Báo chí in chỉ tập trung phân phối tại các trung tâm đô thị lớn, còn sách hướng tới đối tượng học thuật trong thư viện",
      "Báo chí in dựa hoàn toàn vào văn bản thuần túy, còn sách và tạp chí mới kết hợp hình ảnh minh họa lẫn bố cục đồ họa",
      "Báo chí in hoạt động chủ yếu nhờ ngân sách nhà nước, còn sách và xuất bản phụ thuộc hoàn toàn vào nguồn thu quảng cáo"
    ],
    0,
    "Cả hai đều dùng công nghệ in nhưng khác chức năng: báo chí in gắn với thời sự định kỳ & dư luận, sách gắn với tri thức hệ thống dài hạn."
  ],
  [
    "Đặt cạnh Phát thanh và Truyền hình truyền thống, đặc trưng tiếp nhận nổi bật nhất của Điện ảnh (phim truyện, phim tài liệu, phim phổ biến kiến thức) là gì?",
    [
      "Là phương tiện truyền thống duy nhất kết hợp đồng thời giữa hình ảnh chuyển động và hệ thống âm thanh",
      "Truyền tải tin tức thời sự trực tiếp đến hàng triệu hộ gia đình trong cùng một khung giờ phát sóng cố định",
      "Tạo ra trải nghiệm thưởng thức tập trung, giàu chiều sâu nghệ thuật và cảm xúc trong không gian công cộng khép kín",
      "Cho phép công chúng vừa tiếp nhận thông tin vừa thực hiện song song các hoạt động thường nhật như di chuyển hay làm việc"
    ],
    2,
    "A nhầm với TV (cũng có hình + tiếng), B là TV trực tiếp, D là đặc trưng \"nghe song song\" của Radio; Điện ảnh nổi bật ở trải nghiệm tập trung trong rạp."
  ],
  [
    "Trong bối cảnh đầu thế kỷ 20, yếu tố nào giúp Phát thanh (Radio) mở rộng nhanh nhóm công chúng đại chúng mà Báo chí in trước đó khó tiếp cận trực tiếp?",
    [
      "Cho phép người dân tự do chọn lại bất kỳ chương trình cũ nào để nghe vào khung giờ mong muốn",
      "Không đòi hỏi kỹ năng đọc chữ viết và cho phép tiếp nhận tin tức song song khi đang làm việc khác",
      "Kết hợp đồng thời cả hình ảnh chuyển động lẫn âm thanh sống động giúp minh họa trực quan các sự kiện",
      "Cho phép thính giả gửi phản hồi tức thì bằng văn bản ngay trên thiết bị thu sóng tại gia đình"
    ],
    1,
    "A là bẫy của Podcast, C là Truyền hình/Điện ảnh, D là Internet; ưu thế lịch sử của Radio là vượt rào cản biết chữ và nghe song song."
  ],
  [
    "So với Báo chí điện tử giai đoạn đầu, sự bùng nổ của Mạng xã hội (Facebook, Instagram, TikTok) tạo ra thay đổi cấu trúc sâu sắc nhất nào trong dòng chảy thông tin đại chúng?",
    [
      "Lần đầu tiên cho phép tích hợp văn bản, hình ảnh tĩnh và video vào chung một bài đăng trực tuyến",
      "Xóa bỏ hoàn toàn vai trò sản xuất tin tức chuyên nghiệp của các tòa soạn báo chí truyền thống",
      "Đảm bảo mọi thông tin lan truyền trên nền tảng đều được biên tập và kiểm chứng trước khi hiển thị",
      "Chuyển công chúng từ vai trò tiếp nhận sang đồng thời tạo lập, bình luận và tái phân phối thông tin theo mạng lưới và thuật toán"
    ],
    3,
    "A là đặc trưng của Báo chí điện tử (multimedia), B cực đoan sai thực tế, C ngược với cơ chế mạng xã hội; bước ngoặt nằm ở mô hình nhiều-tới-nhiều qua mạng lưới và thuật toán."
  ],
  [
    "Một đài phát thanh đăng tải lại chuỗi tọa đàm hằng tuần lên Spotify và YouTube (có quay hình phòng thu) để thính giả chủ động chọn tập và nghe bất cứ lúc nào. Xét trong hệ sinh thái Internet, hình thức này thuộc nhóm nào?",
    [
      "Phát thanh truyền thống, vì đơn vị sản xuất nội dung gốc vẫn là một đài phát thanh chính thống",
      "Podcast, bao gồm cả định dạng nghe theo yêu cầu (audio on demand) và video podcast",
      "OTT / Streaming, vì chương trình được truyền tải qua Internet thay vì sóng vô tuyến FM",
      "Báo chí điện tử, vì nội dung tọa đàm bàn luận trực tiếp các vấn đề thời sự trong tuần"
    ],
    1,
    "Bẫy nằm ở cụm \"đài phát thanh\" (A) và \"qua Internet\" (C); phát hành theo tập để nghe/xem chủ động có hình thuộc Podcast / Video podcast."
  ],
  [
    "Cả Netflix và YouTube đều phát video qua Internet, nhưng Netflix được xếp tiêu biểu cho OTT / Streaming thay vì Video trực tuyến phổ thông chủ yếu dựa trên ranh giới nào?",
    [
      "Netflix chỉ tương thích với màn hình tivi thông minh, còn YouTube tối ưu cho điện thoại di động",
      "Netflix chỉ phát các sự kiện truyền hình trực tiếp theo khung giờ, còn YouTube cho phép xem lại tự do",
      "Netflix cung cấp kho phim và chương trình có bản quyền, biên tập theo mô hình xem theo yêu cầu thay vì nền tảng mở do người dùng tự đăng tải",
      "Netflix không sử dụng thuật toán gợi ý cá nhân hóa, còn YouTube hoàn toàn vận hành theo thuật toán đề xuất"
    ],
    2,
    "Ranh giới giữa OTT (Netflix) và Video trực tuyến mở (YouTube) nằm ở kho phim/truyền hình bản quyền có biên tập theo yêu cầu vs. nội dung do người dùng tự tải lên."
  ],
  [
    "Một chuyên gia tài chính không thuộc tòa soạn nào, tự xây kênh phân tích thị trường trên TikTok, YouTube và bản tin cá nhân, tạo sức ảnh hưởng lớn tới quyết định chi tiêu của giới trẻ. Hiện tượng này thể hiện rõ nhất vai trò của nhóm nào?",
    [
      "Creator & Influencer — cá nhân trở thành chủ thể sản xuất và phân phối nội dung độc lập tới công chúng",
      "Mạng xã hội — vì toàn bộ quá trình lan truyền nội dung đều diễn ra bên trong một ứng dụng kết nối bạn bè",
      "Báo chí điện tử — vì nội dung có tính phân tích chuyên sâu và cập nhật thường xuyên về tin tức kinh tế",
      "Nền tảng tìm kiếm — vì công chúng chủ động tìm đến kênh này mỗi khi có nhu cầu tra cứu kiến thức tài chính"
    ],
    0,
    "Phân biệt chủ thể sản xuất – phân phối cá nhân (Creator & Influencer) với hạ tầng phân phối (Mạng xã hội)."
  ],
  [
    "Khi đặt Nền tảng tìm kiếm (như Google Search truyền thống) cạnh AI & trung gian thông tin (như Chatbot AI), sự dịch chuyển lớn nhất trong cách công chúng tiếp cận tri thức là gì?",
    [
      "Nền tảng tìm kiếm chỉ vận hành bằng từ khóa cố định, còn Chatbot AI hoàn toàn không cần câu lệnh đầu vào",
      "Nền tảng tìm kiếm không sử dụng thuật toán xếp hạng, còn Chatbot AI là hệ thống đầu tiên áp dụng thuật toán lọc tin",
      "AI và trung gian thông tin đã thay thế hoàn toàn nhu cầu sản xuất nội dung gốc của báo chí và nhà sáng tạo",
      "Nền tảng tìm kiếm trả về danh sách nguồn để người dùng tự đọc và đối chiếu, còn AI trực tiếp tổng hợp và diễn giải câu trả lời thay cho người dùng"
    ],
    3,
    "Chuyển từ dẫn nguồn cho người đọc tự tổng hợp (Search) sang AI trực tiếp tổng hợp và làm trung gian diễn giải."
  ]
];
const letters = "ABCD";
const quizConsole = $("#quiz-console");
const slide = $("#quiz-slide");
const timer = $("#timer");
const timerStatus = $("#timer-status");
const startTimer = $("#start-timer");
const openAnswers = $("#open-answers");
const confirmDialog = $("#confirm-answers");
const answerDialog = $("#answer-dialog");
const presets = [...document.querySelectorAll("[data-seconds]")];
let question = 0;
let duration = 30;
let remaining = 30_000;
let deadline = 0;
let tickHandle;
let alarmEnabled = true;
let timerState = "Sẵn sàng";

function updateClock() {
  const seconds = Math.ceil(remaining / 1000);
  const format = value => String(value).padStart(2, "0");
  const time = format(Math.floor(seconds / 60)) + ":" + format(seconds % 60);
  if (timer.textContent !== time) timer.textContent = time;
  if (timerStatus.textContent !== timerState) timerStatus.textContent = timerState;
  startTimer.textContent = deadline ? "Tạm dừng" : "Bắt đầu";
  openAnswers.disabled = Boolean(deadline);
}
function stopClock() {
  clearInterval(tickHandle);
  deadline = 0;
}
function resetClock() {
  stopClock();
  remaining = duration * 1000;
  timerState = "Sẵn sàng";
  updateClock();
}
function tick() {
  if (!deadline) return;
  remaining = Math.max(0, deadline - performance.now());
  if (remaining === 0) {
    stopClock();
    timerState = "Hết giờ";
    if (alarmEnabled) playNotes([660, 510, 390], .13);
  }
  updateClock();
}
startTimer.addEventListener("click", () => {
  if (deadline) {
    tick();
    stopClock();
    if (remaining > 0) timerState = "Đã tạm dừng";
  } else {
    if (alarmEnabled) getAudio();
    if (!remaining) remaining = duration * 1000;
    deadline = performance.now() + remaining;
    timerState = "Đang đếm ngược";
    tickHandle = setInterval(tick, 100);
  }
  updateClock();
});
document.addEventListener("visibilitychange", tick);
$("#add-time").addEventListener("click", () => {
  if (deadline) {
    deadline += 10_000;
    tick();
  } else {
    remaining += 10_000;
    if (timerState === "Hết giờ") timerState = "Sẵn sàng";
    updateClock();
  }
});
$("#reset-timer").addEventListener("click", resetClock);
$("#alarm").addEventListener("click", event => {
  alarmEnabled = !alarmEnabled;
  if (alarmEnabled) getAudio();
  event.currentTarget.textContent = "Âm báo: " + (alarmEnabled ? "Bật" : "Tắt");
  event.currentTarget.setAttribute("aria-pressed", alarmEnabled);
});
presets.forEach(button => {
  button.setAttribute("aria-pressed", Number(button.dataset.seconds) === duration);
  button.addEventListener("click", () => {
    duration = Number(button.dataset.seconds);
    presets.forEach(item => item.setAttribute("aria-pressed", item === button));
    resetClock();
  });
});

function renderQuestion(focus = false) {
  const [prompt, choices] = questions[question];
  const list = make("ol", "", "quiz-options");
  choices.forEach((choice, index) => {
    const item = make("li");
    item.append(make("b", letters[index] + "."), make("span", choice));
    list.append(item);
  });
  slide.replaceChildren(make("p", "Câu " + (question + 1) + " / " + questions.length, "eyebrow"), make("h3", prompt), list);
  $("#quiz-prev").disabled = question === 0;
  $("#quiz-next").disabled = question === questions.length - 1;
  if (focus) slide.focus({ preventScroll: true });
}
function moveQuestion(offset) {
  question = Math.max(0, Math.min(questions.length - 1, question + offset));
  resetClock();
  renderQuestion(true);
}
$("#quiz-prev").addEventListener("click", () => moveQuestion(-1));
$("#quiz-next").addEventListener("click", () => moveQuestion(1));
renderQuestion();

openAnswers.addEventListener("click", () => {
  if (deadline) return;
  confirmDialog.returnValue = "";
  confirmDialog.showModal();
});
confirmDialog.addEventListener("close", () => {
  if (confirmDialog.returnValue !== "reveal" || deadline) return;
  $("#answer-list").replaceChildren(...questions.map(([, choices, correct, reasoning]) => {
    const item = make("li");
    item.append(make("strong", letters[correct] + " · " + choices[correct]), make("span", reasoning));
    return item;
  }));
  answerDialog.showModal();
  answerDialog.scrollTop = 0;
});
answerDialog.addEventListener("close", () => {
  $("#answer-list").replaceChildren();
  openAnswers.focus();
});

const fullscreen = $("#fullscreen");
function updateFullscreen() {
  const enabled = document.fullscreenElement === quizConsole || quizConsole.classList.contains("projector");
  fullscreen.textContent = enabled ? "Thoát toàn màn hình" : "Toàn màn hình";
}
fullscreen.addEventListener("click", async () => {
  if (document.fullscreenElement === quizConsole) {
    await document.exitFullscreen();
  } else if (quizConsole.classList.contains("projector")) {
    quizConsole.classList.remove("projector");
  } else {
    try {
      await quizConsole.requestFullscreen();
    } catch {
      quizConsole.classList.add("projector");
    }
  }
  updateFullscreen();
});
document.addEventListener("fullscreenchange", updateFullscreen);
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !confirmDialog.open && !answerDialog.open && quizConsole.classList.contains("projector")) {
    quizConsole.classList.remove("projector");
    updateFullscreen();
    fullscreen.focus();
  }
});
