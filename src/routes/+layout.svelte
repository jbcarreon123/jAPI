<script lang="ts">
	import '../app.css';
	let { children } = $props();

	import { fade } from 'svelte/transition';
    import { page } from '$app/state';
</script>

<style>
	@media (width >= 48rem) {
		#main-container {
			grid-template-columns: 75% 25%;
		}
	}
</style>

<div id="main-container" class="grid gap-2">
	<main class="border-2 p-3 order-2 md:order-1" in:fade={{ duration: 200 }} out:fade={{ duration: 200 }}>
		{@render children()}
	</main>
	<aside class="border-2 p-3 order-1 md:order-2 flex justify-between md:justify-normal md:flex-col gap-2">
		<div id="links" class="flex flex-col">
			<a href="/">Home <i class="text-grv-subtext0">(you are here)</i></a>
			<a href="/api">API Docs</a>
		</div>
		<div id="user" class="text-right md:pt-5 md:text-left">
			<p>Oh hello there, JB!</p>
			<a href="/dash">Dashboard</a>
			<a href="/cfg">Settings</a>
			<a href="/">Log out</a>
		</div>
		<div id="check-out" class="pt-5 hidden md:block">
			<p>Check out these resources!</p>
			<a href="https://loveberry.nekoweb.org" target="_blank">Loveberry</a>
		</div>
	</aside>
</div>

<footer class="pt-5 w-full text-center">
	Made by 
	<a href="https://jbcarreon123.nekoweb.org" target="_blank">jbcarreon123</a>
	and 
	<a href="https://maxpixels.moe" target="_blank">maxpixels</a>
</footer>