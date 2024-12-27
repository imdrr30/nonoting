import { AfterViewInit, Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { EditorComponent } from "../editor/editor.component";
import { CommonModule } from '@angular/common';
import { v4 as uuidv4 } from 'uuid';
import * as CryptoJS from 'crypto-js';
import { TooltipService } from '../services/tooltip.service';
import { PromptService } from '../services/prompt.service';


@Component({
  selector: 'app-nonote',
  imports: [EditorComponent, CommonModule],
  templateUrl: './nonote.component.html',
  styleUrl: './nonote.component.css'
})
export class NonoteComponent implements AfterViewInit {

  notes: any = []
  public passwordProtected: boolean = false;
  password: string = ""
  savingStatus = 0;

  ENCRYTPED_DATA_KEY = "encryptedData"
  LOCALSTORAGE_KEY = "notes"
  EXTENSION_OF_NONOTE = ".nonote"
  DEFAULT_DOWNLOAD_FILE_NAME = "notes" + this.EXTENSION_OF_NONOTE
  autoFocus = false;

  async getAndValidatePassword(encryptedData: any){
    let password = await this.promtService.prompt("This note is Password Protected. Please enter the password: ");
    let decryptedString = "";

    while(true){
      try{
        if(password){
          let bytes = CryptoJS.AES.decrypt(encryptedData, password);
          decryptedString = bytes.toString(CryptoJS.enc.Utf8);
          if(decryptedString){
            this.passwordProtected = true;
            this.password = password;
            break;
          }else{
            password = await this.promtService.prompt("Invalid Password. Try again: ");
          }
        }
      }catch(error){
        password = await this.promtService.prompt("Invalid Password. Try again: ");
      }
    }

    return decryptedString;

  }

  async toggleAndChangePasswordProtection(){

    if(this.passwordProtected && this.password){
      let newPassword = await this.promtService.prompt(
        "This note is password protected. Enter new pasword to change. Leave it empty to disable password"
      )

      if(newPassword==""){
        this.passwordProtected = false;
        this.password = ""
      }else if(newPassword){
        this.passwordProtected = true;
        this.password = newPassword;
      }
    }else{
      let newPassword = await this.promtService.prompt(
      "Enter the new password to protect the note with: "
      )
      if(newPassword && newPassword!=""){
        this.passwordProtected = true;
        this.password = newPassword;
      }

    }

    this.saveToLocalStorage();

  }

  async checkForEncryption(jsonData: any){
    let encryptedData = jsonData.hasOwnProperty(this.ENCRYTPED_DATA_KEY) ? jsonData[this.ENCRYTPED_DATA_KEY] : false;
    if(encryptedData){
      return JSON.parse(await this.getAndValidatePassword(encryptedData));
    }
    
    return jsonData;
  }

  async readFromLocalStorage(){
    let notes = JSON.parse(localStorage.getItem(this.LOCALSTORAGE_KEY) ?? "[]");
    return await this.checkForEncryption(notes);
  }

  getNonEmptyNotes(){
    let nonEmptyNotes: any = [];
    for(let note of this.notes){
      if(note.data!= ""){
        nonEmptyNotes.push(note)
      }
    }
    return nonEmptyNotes;
  }

  getNotesJson(){
    let json = JSON.stringify(this.getNonEmptyNotes());
    if(this.passwordProtected && this.password !== ""){
      const encrypted = CryptoJS.AES.encrypt(json, this.password).toString();
      let data:any = {}
      data[this.ENCRYTPED_DATA_KEY] = encrypted
      json = JSON.stringify(data);
    }
    return json
  }

  saveToLocalStorage(){
    this.savingStatus = 1;
    localStorage.setItem(this.LOCALSTORAGE_KEY, this.getNotesJson());
    this.savingStatus = 2;
  }

  async ngAfterViewInit(){
    this.autoFocus=false;
    this.notes = await this.readFromLocalStorage();
    this.autoFocus=true;
  }

  editorFocused(){
    this.isFocused = true;
  }

  isFocused = false;
  isDragging = false; // Flag to track whether we are dragging
  offsetX = 0;  // Mouse offset relative to the element's top-left corner
  offsetY = 0;  // Mouse offset relative to the element's top-left corner
  dragNote: any;
  cursorX = 0;
  cursorY = 0;
  @ViewChild('fileInput') fileInput: ElementRef | undefined;

  onDataChange(event:any, note:any){
    note.data = event;
    this.saveToLocalStorage();
  }

  constructor(private readonly tooltipService: TooltipService, private readonly promtService: PromptService) {}

  // Start dragging
  onMouseDown(event: any, note: any) {

    if (event.target !== event.currentTarget) {

      if( event.target.className && 
        (
          event.target.className.includes("ck-button")
          || event.target.className.includes("ck-toolbar")
          || event.target.className.includes("ck-word-count")
          || event.target.className.includes("move")
        )
      ){

      }else{
        return;
      }
    }

    this.isDragging = true;
    this.dragNote = note;

    // Calculate the offset between mouse position and the div's top-left corner
    this.offsetX = event.clientX - this.dragNote.position[0];
    this.offsetY = event.clientY - this.dragNote.position[1];

    // Add mousemove and mouseup listeners to document
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
  }

  // Mousemove event handler
  onMouseMove = (event: MouseEvent) => {
    if (this.isDragging) {
      this.dragNote.position[0] = event.clientX - this.offsetX;  // Update the left position
      this.dragNote.position[1] = event.clientY - this.offsetY;   // Update the top position
    }
  };

  // Mouseup event handler to stop dragging
  onMouseUp = () => {
    this.isDragging = false;
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    this.saveToLocalStorage();
  };

  singleClick(event: MouseEvent){
    if (event.target !== event.currentTarget) {
      return;
    }
    this.currentNote = "";
  }

  createNewNote(event: MouseEvent){
    if (event.target !== event.currentTarget) {
      return;
    }

    const x = event.pageX;
    const y = event.pageY;

    let note = {
      data: "",
      uuid: uuidv4(),
      position: [x-30,y-75]
    }

    this.notes.push(note)

    this.currentNote = note.uuid

    
  }

  currentNote: any
  selectCurrentNote(uuid: any){
    this.currentNote = uuid;
  }

  deleteCurrentNote(){
    this.notes = this.notes.filter((i: any) => i.uuid !== this.currentNote);
    this.currentNote = "";
    this.saveToLocalStorage();
  }

  @HostListener('document:mousemove', ['$event'])
  async onMouseMoveHost(event: MouseEvent) {
    this.cursorX = event.pageX;
    this.cursorY = event.pageY;
  }

  @HostListener('document:keydown', ['$event'])
  async onKeydownHost(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey)) {
      if(event.key === 's'){
        event.preventDefault();
        this.saveAsJson();
      }
      if(event.key === 'o'){
        event.preventDefault();
        this.openFileDialog();
      }

      if(event.shiftKey && event.key == 'p'){
        await this.toggleAndChangePasswordProtection();
      }
    }

    if(this.currentNote=="" && event.key === 'n'){
      this.createNewNote(
        {
          pageX: this.cursorX,
          pageY: this.cursorY
        } as MouseEvent
      )
    }
    
  }

  onKeydown(event: KeyboardEvent) {
    if (event.shiftKey) {
      if ( ['Backspace', 'Delete'].includes(event.key)) {
        this.deleteCurrentNote()
      }
    }
  }

  // Open the file dialog
  openFileDialog() {
    if(this.fileInput)
    this.fileInput.nativeElement.click();
  }

  // Handle the file selection and read the .nonote file as JSON
  async onFileSelected(event: Event) {
    const fileInput = event.target as HTMLInputElement;
    const file = fileInput?.files?.[0];

    if (file && file.name.endsWith('.nonote')) {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const fileContent = reader.result as string;
          const jsonContent = JSON.parse(fileContent);
          this.autoFocus = false;
          this.notes = await this.checkForEncryption(jsonContent);
          this.autoFocus = true;
          // You can now work with your JSON data here
        } catch (e) {
          console.error('Error reading file as JSON:', e);
        }
      };
      reader.readAsText(file); // Read the file as text
    } else {
      alert('Please select a .nonote file.');
    }
  }


  saveAsJson(){
    let json = this.getNotesJson();

    // Create a Blob from the JSON string
    const blob = new Blob([json], { type: 'application/json' });

    // Create a temporary link element to trigger the download
    const link = document.createElement('a');
    const url = window.URL.createObjectURL(blob);
    link.href = url;
    link.download = this.DEFAULT_DOWNLOAD_FILE_NAME; // Specify the file name
    link.click(); // Trigger the download

    // Clean up by revoking the Blob URL
    window.URL.revokeObjectURL(url);
  }

}
